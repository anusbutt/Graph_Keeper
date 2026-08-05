# Correction repositories

Each child directory is a complete `graph/` snapshot for correction-chain tests:

- `valid-chain` contains three generations in one non-branching, acyclic chain.
- `invalid-fork` adds a competing direct successor to the original claim.
- `invalid-cycle` links three generations into a cycle.

The fixtures use inference sources so correction topology can be tested independently
from physical evidence inspection.
