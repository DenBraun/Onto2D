# Clinical Trajectories Model Pack

This directory compiles the exact `mimic-iv-demo-clinical-trajectories-v1`
case artifact into a portable Onto2D Model Pack.

The graph exposes five source-deidentified patient scopes, their focus
admissions and ICU stays, bounded four-lab observation frames, recorded-history
summaries, one descriptive similar-frame comparison, and explicit clinical-use
boundaries. It intentionally does not encode diagnosis, prognosis, treatment
recommendation, treatment effect, medication administration, causal edges, or
real calendar dates.

Build or verify the release from the repository root:

```sh
npm run model:clinical-trajectories
npm run model:clinical-trajectories:verify
```
