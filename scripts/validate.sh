#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  printf '%s\n' 'GK002 expected --staged or --worktree' >&2
  exit 2
fi
mode=$1
case "$mode" in
  --staged|--worktree) ;;
  *) printf '%s\n' 'GK002 invalid validator mode' >&2; exit 2 ;;
esac

failures=0
fail() {
  code=$1
  shift
  printf '%s %s\n' "$code" "$*" >&2
  failures=$((failures + 1))
}

command -v git >/dev/null 2>&1 || {
  printf '%s\n' 'GK003 git is required' >&2
  exit 3
}
command -v jq >/dev/null 2>&1 || {
  printf '%s\n' 'GK003 jq 1.6 or newer is required' >&2
  exit 3
}
jq_version=$(jq --version 2>/dev/null || true)
jq_number=${jq_version#jq-}
jq_major=${jq_number%%.*}
jq_minor_tail=${jq_number#*.}
jq_minor=${jq_minor_tail%%[!0-9]*}
jq_version_ok=0
case "$jq_major:$jq_minor" in
  *[!0-9:]*|:|*:) ;;
  *)
    if [ "$jq_major" -gt 1 ] ||
      { [ "$jq_major" -eq 1 ] && [ "$jq_minor" -ge 6 ]; }; then
      jq_version_ok=1
    fi
    ;;
esac
if [ "$jq_version_ok" -ne 1 ]; then
  printf '%s\n' 'GK003 jq 1.6 or newer is required' >&2
  exit 3
fi

root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  printf '%s\n' 'GK004 not inside a Git repository' >&2
  exit 4
}
cd "$root"

tmp=$(mktemp -d 2>/dev/null) || {
  printf '%s\n' 'GK004 unable to create temporary directory' >&2
  exit 4
}
trap 'rm -rf "$tmp"' EXIT HUP INT TERM

load_selected() {
  path=$1
  out=$2
  if [ "$mode" = '--staged' ]; then
    if git cat-file -e ":$path" 2>/dev/null; then
      git show ":$path" > "$out" ||
        fail GK004 "[$path] cannot read staged file; fix: restage a readable file"
    else
      fail GK101 "[$path] required staged file is missing; fix: add and stage the required file"
      printf '%s\n' '[]' > "$out"
    fi
  elif [ -f "$path" ]; then
    cp "$path" "$out" || fail GK004 "[$path] cannot read file; fix: restore read permission"
  else
    fail GK101 "[$path] required file is missing; fix: restore it or run graphkeeper init"
    printf '%s\n' '[]' > "$out"
  fi
}

entities=$tmp/entities.json
claims=$tmp/claims.json
runs=$tmp/runs.json
load_selected graph/entities.json "$entities"
load_selected graph/claims.json "$claims"
load_selected graph/runs.json "$runs"

parse_ok=1
if ! jq empty "$entities" >/dev/null 2>&1; then
  fail GK102 '[graph/entities.json] invalid JSON; fix: restore a valid JSON array'
  parse_ok=0
fi
if ! jq empty "$claims" >/dev/null 2>&1; then
  fail GK102 '[graph/claims.json] invalid JSON; fix: restore a valid JSON array'
  parse_ok=0
fi
if ! jq empty "$runs" >/dev/null 2>&1; then
  fail GK102 '[graph/runs.json] invalid JSON; fix: restore a valid JSON array'
  parse_ok=0
fi

if [ "$parse_ok" -eq 1 ]; then
  if ! jq -e '
    def exact_keys($required; $optional):
      . as $o
      | all($required[]; . as $k | $o | has($k))
        and ((keys_unsorted - ($required + $optional)) | length == 0);
    def nonempty: type == "string" and length > 0;
    def slug: nonempty and test("^[a-z0-9]+(_[a-z0-9]+)*$");
    def utc:
      . as $value
      | type == "string"
      and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$")
      and ((try (fromdateiso8601 | todateiso8601) catch null) == $value);
    def unique_strings:
      type == "array"
      and all(.[]; type == "string" and length > 0)
      and length == (unique | length);
    def safe_segments:
      split("/") | all(. != "" and . != "." and . != "..");
    def evidence_ref:
      type == "string"
      and test("^evidence/[^[:space:]#]+#L[0-9]+-L[0-9]+$")
      and (split("#")[0] | safe_segments);
    type == "array"
    and all(.[];
      exact_keys(["id", "type", "aliases", "first_seen"]; ["source_docs"])
      and (.id | slug)
      and (.type | slug)
      and (.aliases | unique_strings)
      and ((.source_docs // []) | unique_strings)
      and all((.source_docs // [])[]; evidence_ref)
      and (.first_seen | utc)
    )
    and ([.[].id] | length == (unique | length))
  ' "$entities" >/dev/null; then
    entity_ids=$(jq -r '
      if type == "array" then
        [to_entries[] | (try (.value.id // ("index_" + (.key | tostring))) catch ("index_" + (.key | tostring)))] | join(",")
      else "root" end
    ' "$entities" 2>/dev/null || printf '%s' 'unknown')
    entity_duplicates=$(jq -r '
      if type == "array" then
        [.[] | select(type == "object" and (.id | type == "string")) | .id]
        | group_by(.) | map(select(length > 1) | .[0]) | join(",")
      else "" end
    ' "$entities" 2>/dev/null || true)
    entity_detail="records=$entity_ids"
    if [ -n "$entity_duplicates" ]; then
      entity_detail="duplicate_ids=$entity_duplicates; $entity_detail"
    fi
    fail GK110 "[graph/entities.json:$entity_ids] entity schema or ID uniqueness violation ($entity_detail); fix: correct the named records and keep IDs unique"
  fi

  if ! jq -e '
    def exact_keys($required; $optional):
      . as $o
      | all($required[]; . as $k | $o | has($k))
        and ((keys_unsorted - ($required + $optional)) | length == 0);
    def nonempty: type == "string" and length > 0;
    def snake: nonempty and test("^[a-z0-9]+(_[a-z0-9]+)*$");
    def utc:
      . as $value
      | type == "string"
      and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$")
      and ((try (fromdateiso8601 | todateiso8601) catch null) == $value);
    def safe_segments:
      split("/") | all(. != "" and . != "." and . != "..");
    def evidence_ref:
      type == "string"
      and test("^evidence/[^[:space:]#]+#L[0-9]+-L[0-9]+$")
      and (split("#")[0] | safe_segments);
    def source:
      if .kind == "tool_output" then
        exact_keys(
          ["kind", "command", "exit_code", "ref", "captured"];
          []
        )
        and (.command | nonempty)
        and (.exit_code |
          type == "number" and . == floor and . >= 0 and . <= 255
        )
        and (.ref | evidence_ref)
        and (.captured | utc)
      elif .kind == "inference" then
        exact_keys(["kind"]; ["basis"])
        and ((has("basis") | not) or (.basis | nonempty))
      else false
      end;
    type == "array"
    and all(.[];
      exact_keys(
        ["id", "subject", "predicate", "object", "source",
         "produced_by", "created"];
        ["confidence", "supersedes"]
      )
      and (.id | type == "string" and test("^claim_[0-9a-f]{8}$"))
      and (.subject | nonempty)
      and (.predicate | snake)
      and (.object | nonempty)
      and (.source | source)
      and (.produced_by |
        type == "string"
        and test("^run_[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9][a-z0-9_-]*$")
      )
      and (.created | utc)
      and ((has("confidence") | not) or
        (.confidence | type == "number" and . >= 0 and . <= 1)
      )
      and ((has("supersedes") | not) or
        (.supersedes | type == "string" and test("^claim_[0-9a-f]{8}$"))
      )
    )
    and ([.[].id] | length == (unique | length))
  ' "$claims" >/dev/null; then
    claim_ids=$(jq -r '
      if type == "array" then
        [to_entries[] | (try (.value.id // ("index_" + (.key | tostring))) catch ("index_" + (.key | tostring)))] | join(",")
      else "root" end
    ' "$claims" 2>/dev/null || printf '%s' 'unknown')
    claim_duplicates=$(jq -r '
      if type == "array" then
        [.[] | select(type == "object" and (.id | type == "string")) | .id]
        | group_by(.) | map(select(length > 1) | .[0]) | join(",")
      else "" end
    ' "$claims" 2>/dev/null || true)
    claim_detail="records=$claim_ids"
    if [ -n "$claim_duplicates" ]; then
      claim_detail="duplicate_ids=$claim_duplicates; $claim_detail"
    fi
    fail GK120 "[graph/claims.json:$claim_ids] claim schema or ID uniqueness violation ($claim_detail); fix: correct the named records and source shape"
  fi

  if ! jq -e '
    def exact_keys($required; $optional):
      . as $o
      | all($required[]; . as $k | $o | has($k))
        and ((keys_unsorted - ($required + $optional)) | length == 0);
    def nonempty: type == "string" and length > 0;
    def utc:
      . as $value
      | type == "string"
      and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$")
      and ((try (fromdateiso8601 | todateiso8601) catch null) == $value);
    def unique_strings:
      type == "array"
      and all(.[]; type == "string" and length > 0)
      and length == (unique | length);
    def safe_segments:
      split("/") | all(. != "" and . != "." and . != "..");
    def evidence_path:
      type == "string"
      and test("^evidence/[^[:space:]#]+$")
      and safe_segments;
    type == "array"
    and all(.[];
      . as $run
      | exact_keys(
          ["id", "started", "tool", "evidence", "claims_written"];
          ["task", "ended", "verdict"]
        )
        and (.id |
          type == "string"
          and test("^run_[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9][a-z0-9_-]*$")
        )
        and (.started | utc)
        and (.tool | nonempty)
        and ((has("task") | not) or (.task | nonempty))
        and (.evidence | unique_strings)
        and all(.evidence[]; evidence_path)
        and (.claims_written | unique_strings)
        and all(.claims_written[];
          test("^claim_[0-9a-f]{8}$")
        )
        and (has("ended") == has("verdict"))
        and (
          if has("verdict") then
            (.ended | utc)
            and ((.ended | fromdateiso8601) >=
                 (.started | fromdateiso8601))
            and (.verdict |
              . == "passed" or . == "failed" or
              . == "inconclusive" or . == "aborted"
            )
          else true
          end
        )
    )
    and ([.[].id] | length == (unique | length))
  ' "$runs" >/dev/null; then
    run_ids=$(jq -r '
      if type == "array" then
        [to_entries[] | (try (.value.id // ("index_" + (.key | tostring))) catch ("index_" + (.key | tostring)))] | join(",")
      else "root" end
    ' "$runs" 2>/dev/null || printf '%s' 'unknown')
    run_duplicates=$(jq -r '
      if type == "array" then
        [.[] | select(type == "object" and (.id | type == "string")) | .id]
        | group_by(.) | map(select(length > 1) | .[0]) | join(",")
      else "" end
    ' "$runs" 2>/dev/null || true)
    run_detail="records=$run_ids"
    if [ -n "$run_duplicates" ]; then
      run_detail="duplicate_ids=$run_duplicates; $run_detail"
    fi
    fail GK130 "[graph/runs.json:$run_ids] run schema, lifecycle, or ID uniqueness violation ($run_detail); fix: correct the named records and lifecycle fields"
  fi

  if ! jq -e \
    --slurpfile entities "$entities" \
    --slurpfile runs "$runs" '
    def acyclic($index; $id; $seen):
      if $id == null then true
      elif $seen[$id] == true then false
      else acyclic(
        $index;
        ($index[$id].supersedes // null);
        $seen + {($id): true}
      )
      end;
    INDEX($entities[0][]; .id) as $by_entity
    | INDEX($runs[0][]; .id) as $by_run
    | INDEX(.[]; .id) as $by_claim
    | ([.[] | select(has("supersedes")) | .supersedes]) as $targets
    | (reduce $runs[0][] as $run ({};
        .[$run.id] = (reduce $run.claims_written[] as $id ({}; .[$id] = true))
      )) as $written_by_run
    | (reduce $runs[0][] as $run ({};
        .[$run.id] = (reduce $run.evidence[] as $path ({}; .[$path] = true))
      )) as $evidence_by_run
    | all(.[];
        ($by_entity[.subject] != null)
        and ($by_run[.produced_by] != null)
        and ((has("supersedes") | not) or
          ($by_claim[.supersedes] != null)
        )
      )
      and (($targets | length) == ($targets | unique | length))
      and all(.[]; acyclic($by_claim; .id; {}))
      and all($runs[0][];
        . as $run
        | all($run.claims_written[];
            . as $id
            | $by_claim[$id] != null
              and $by_claim[$id].produced_by == $run.id
          )
      )
      and all(.[];
        . as $claim
        | $written_by_run[$claim.produced_by][$claim.id] == true
      )
      and all(.[];
        . as $claim
        | if $claim.source.kind == "tool_output" then
            ($claim.source.ref | split("#")[0]) as $path
            | $evidence_by_run[$claim.produced_by][$path] == true
          else true
          end
      )
  ' "$claims" >/dev/null; then
    relation_context=$(jq -r '
      def cycle_members($index; $start):
        def walk($id; $path):
          if $id == null or $index[$id] == null then []
          elif ($path | index($id)) != null then
            ($path | index($id)) as $at | $path[$at:]
          else
            walk(($index[$id].supersedes // null); $path + [$id])
          end;
        walk($start; []);
      INDEX(.[]; .id) as $by_claim
      | ([.[] | select(has("supersedes"))]
          | group_by(.supersedes)
          | map(select(length > 1))) as $forks
      | ([.[] | cycle_members($by_claim; .id)[]] | unique) as $cycles
      | if ($forks | length) > 0 then $forks[0][0].supersedes
        elif ($cycles | length) > 0 then $cycles[0]
        else empty
        end
    ' "$claims" 2>/dev/null || true)
    relation_detail=$(jq -r --slurpfile entities "$entities" --slurpfile runs "$runs" '
      def cycle_members($index; $start):
        def walk($id; $path):
          if $id == null or $index[$id] == null then []
          elif ($path | index($id)) != null then
            ($path | index($id)) as $at | $path[$at:]
          else
            walk(($index[$id].supersedes // null); $path + [$id])
          end;
        walk($start; []);
      INDEX($entities[0][]; .id) as $by_entity
      | INDEX($runs[0][]; .id) as $by_run
      | INDEX(.[]; .id) as $by_claim
      | ([.[] | select(has("supersedes"))] | group_by(.supersedes) | map(select(length > 1))) as $forks
      | ([.[] | cycle_members($by_claim; .id)[]] | unique) as $cycles
      | ([
          if ($forks | length) > 0 then
            ("forks: " + ($forks
              | map(.[0].supersedes + " superseded by " + ([.[].id] | sort | join(",")))
              | join(" | ")))
          else empty end,
          if ($cycles | length) > 0 then
            ("cycle members: " + ($cycles | join(",")))
          else empty end
        ] | join("; ")) as $topology
      | if $topology != "" then $topology
        elif any(.[]; $by_entity[.subject] == null) then
          (first(.[] | select($by_entity[.subject] == null)) | .id + " has unknown subject " + .subject)
        elif any(.[]; $by_run[.produced_by] == null) then
          (first(.[] | select($by_run[.produced_by] == null)) | .id + " has unknown run " + .produced_by)
        elif any(.[]; has("supersedes") and $by_claim[.supersedes] == null) then
          (first(.[] | select(has("supersedes") and $by_claim[.supersedes] == null)) | .id + " has unknown supersedes target " + .supersedes)
        else ([.[].id] | join(",") + " has inconsistent cross-references, a supersession cycle, or provenance")
        end
    ' "$claims" 2>/dev/null || printf '%s' 'unable to isolate conflicting IDs')
    if [ -z "$relation_context" ]; then
      relation_context=$(jq -r 'if type == "array" and length > 0 then .[0].id // "graph/claims.json" else "graph/claims.json" end' "$claims" 2>/dev/null || printf '%s' 'graph/claims.json')
    fi
    fail GK140 "[$relation_context] $relation_detail; fix: repair references, provenance, and use one acyclic supersession successor"
  fi

  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    old_entities=$tmp/old-entities.json
    old_claims=$tmp/old-claims.json
    old_runs=$tmp/old-runs.json
    git show HEAD:graph/entities.json > "$old_entities" 2>/dev/null ||
      printf '%s\n' '[]' > "$old_entities"
    git show HEAD:graph/claims.json > "$old_claims" 2>/dev/null ||
      printf '%s\n' '[]' > "$old_claims"
    git show HEAD:graph/runs.json > "$old_runs" 2>/dev/null ||
      printf '%s\n' '[]' > "$old_runs"

    if ! jq empty "$old_entities" "$old_claims" "$old_runs" \
      >/dev/null 2>&1; then
      fail GK150 'committed graph JSON cannot be parsed'
    else
      if ! jq -e --slurpfile current "$claims" '
        all(.[];
          . as $old
          | any($current[0][];
              .id == $old.id and . == $old
            )
        )
      ' "$old_claims" >/dev/null; then
        changed_claims=$(jq -r --slurpfile current "$claims" '
          [.[] as $old | select((any($current[0][]; .id == $old.id and . == $old)) | not) | $old.id] | join(",")
        ' "$old_claims" 2>/dev/null || printf '%s' 'unknown')
        fail GK151 "[$changed_claims] committed claim changed or was removed; fix: restore it and append a superseding claim"
      fi

      if ! jq -e --slurpfile current "$entities" '
        all(.[];
          . as $old
          | any($current[0][];
              . as $new
              | $new.id == $old.id
                and $new.type == $old.type
                and $new.first_seen == $old.first_seen
                and (($old.aliases - $new.aliases) | length == 0)
                and (
                  (($old.source_docs // []) -
                   ($new.source_docs // [])) | length == 0
                )
            )
        )
      ' "$old_entities" >/dev/null; then
        changed_entities=$(jq -r --slurpfile current "$entities" '
          [.[] as $old | select((any($current[0][]; .id == $old.id and .type == $old.type and .first_seen == $old.first_seen and (($old.aliases - .aliases) | length == 0) and (((($old.source_docs // []) - (.source_docs // [])) | length) == 0))) | not) | $old.id] | join(",")
        ' "$old_entities" 2>/dev/null || printf '%s' 'unknown')
        fail GK152 "[$changed_entities] entity identity changed or an accumulated value was removed; fix: restore identity and only add aliases or source_docs"
      fi

      if ! jq -e --slurpfile current "$runs" '
        all(.[];
          . as $old
          | any($current[0][];
              . as $new
              | $new.id == $old.id
                and (
                  if $old | has("verdict") then
                    $new == $old
                  else
                    $new.started == $old.started
                    and $new.tool == $old.tool
                    and (
                      if $old | has("task") then
                        $new.task == $old.task
                      else true
                      end
                    )
                    and (($old.evidence - $new.evidence) | length == 0)
                    and (
                      ($old.claims_written - $new.claims_written) |
                      length == 0
                    )
                  end
                )
            )
        )
      ' "$old_runs" >/dev/null; then
        changed_runs=$(jq -r --slurpfile current "$runs" '
          def preserved($old; $new):
            $new != null
            and (
              if $old | has("verdict") then
                $new == $old
              else
                $new.started == $old.started
                and $new.tool == $old.tool
                and (
                  if $old | has("task") then
                    $new.task == $old.task
                  else true
                  end
                )
                and (($old.evidence - $new.evidence) | length == 0)
                and (
                  ($old.claims_written - $new.claims_written) |
                  length == 0
                )
              end
            );
          INDEX($current[0][]; .id) as $by_id
          | [.[]
              | . as $old
              | select((preserved($old; $by_id[$old.id])) | not)
              | $old.id
            ]
          | join(",")
        ' "$old_runs" 2>/dev/null || printf '%s' 'unknown')
        fail GK153 "[$changed_runs] invalid open-run transition or closed-run mutation; fix: restore the run or close an open run exactly once"
      fi
    fi

    if [ "$mode" = '--staged' ]; then
      if ! evidence_changes=$(git diff --cached --name-status \
        --diff-filter=MDR HEAD -- evidence/); then
        fail GK004 'unable to compare staged evidence with HEAD'
        evidence_changes=
      fi
    else
      if ! evidence_changes=$(git diff --name-status \
        --diff-filter=MDR HEAD -- evidence/); then
        fail GK004 'unable to compare evidence with HEAD'
        evidence_changes=
      fi
    fi
    if [ -n "$evidence_changes" ]; then
      evidence_first=$(printf '%s\n' "$evidence_changes" | sed -n '1p')
      evidence_path=${evidence_first#*	}
      fail GK154 "[$evidence_path] committed evidence changed, was deleted, or was renamed; fix: restore it and add a new evidence file"
    fi
  fi
fi

if [ "$failures" -ne 0 ]; then
  printf 'GraphKeeper: %s violation(s)\n' "$failures" >&2
  exit 1
fi

printf '%s\n' 'GraphKeeper: validation passed'
exit 0
