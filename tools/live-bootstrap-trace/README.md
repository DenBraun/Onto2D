# live-bootstrap trace exporter prototype

This local prototype resolves a live-bootstrap `steps/manifest` into stable,
machine-readable JSON. It is intentionally limited to manifest syntax,
configuration predicates, event order, source locations, active/inactive status,
and repository revision identity.

It does not model build dependencies, runtime success, trust, path optimality, or
any research metric. Consumers can use the output for audit views, revision
diffs, visualizers, or other research tools without adopting a particular
interpretation framework.

## Input

- the exact manifest bytes;
- a configuration JSON file;
- repository and revision strings;
- an optional repository-relative manifest path.

The included `profiles/default-amd64.json` reproduces the configuration used by
the pinned downstream case. It describes an inspection configuration, not a
claim that the upstream project supports every represented architecture.

## Output

`live-bootstrap-trace.schema.json` defines the minimal output. Every event keeps
its ordinal, directive, arguments, predicate, exact source line and text, and
resolved active status. `traceIdentity` changes when source bytes, revision,
configuration, event order, or event content changes.

## Command

```sh
node tools/live-bootstrap-trace/export.mjs \
  --manifest path/to/live-bootstrap/steps/manifest \
  --config tools/live-bootstrap-trace/profiles/default-amd64.json \
  --repository https://github.com/fosslinux/live-bootstrap \
  --revision 9a268c4c39cae952b268bc86da342be2175f03d4 \
  --output /tmp/live-bootstrap-trace.json
```

This prototype is local only. It has not been submitted upstream.

Run its pinned-revision comparison tests with:

```sh
npm run test:live-bootstrap-trace
```
