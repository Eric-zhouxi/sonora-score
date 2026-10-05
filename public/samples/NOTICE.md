# Sample attribution

`piano-a4.wav`, `violin-a4.wav`, `cello-a4.wav`, and `flute-a4.wav` are compact, mono derivatives of recordings from the University of Iowa Electronic Music Studios Musical Instrument Samples collection, created by Lawrence Fritts and contributors.

The provider states that the recordings have been freely available since 1997 and may be downloaded and used for any projects without restrictions:

https://theremin.music.uiowa.edu/MIS.html

Exact source URLs, labels, byte sizes and SHA-256 checksums are recorded in `assets/samples/manifest.json`. The derivatives were normalized, cropped, faded and linearly resampled to 22.05 kHz/16-bit mono by `python -m sonora_analysis.prepare_web_samples`.

## Guitar and bass samples

`guitar-acoustic-*.mp3`, `guitar-electric-*.mp3`, and `bass-electric-*.mp3` are redistributed unchanged from **N. Brosowsky / tonejs-instruments**, revision `622c2f1c32c8cfce4158ddc3eb26e518ddef37e5`, under **Creative Commons Attribution 3.0 Unported**:

- Collection and attribution: https://github.com/nbrosowsky/tonejs-instruments
- License: https://creativecommons.org/licenses/by/3.0/
- Upstream credits acoustic guitar to the University of Iowa, and electric guitar/bass to Karoryfer: https://github.com/nbrosowsky/tonejs-instruments/blob/master/sample-source-info.txt
- File-level sources and SHA-256 hashes: `assets/samples/expanded-manifest.json`.

## Electronic drums

`drum-*.wav` are original, algorithmically generated electronic drum one-shots, not recordings of acoustic instruments. The deterministic generator is `scripts/prepare-instruments.mjs`; these assets are released under this project's MIT license. No Tone.js example drum recordings are included.
