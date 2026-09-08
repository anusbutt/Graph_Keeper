# Request-processing example

A small, dependency-free Node.js ESM application. Requires Node.js 18 or newer.
It has no server, external service, persistent state, or credentials.

From this directory, try the public entry point:

```sh
node --input-type=module -e 'import { handleRequest } from "./src/handler.js"; console.log(handleRequest({ body: { message: "hello" } }));'
```

For a memory experiment, copy this directory into a new temporary Git repository,
install the exact candidate GraphKeeper package outside it, and initialize its
canonical agent integration. This starter contains no prepopulated graph or evidence.
