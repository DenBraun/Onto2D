export const THREE_NODE_MOTIF_EXPLORER_DATA = Object.freeze({
  "schemaVersion": "1",
  "caseId": "three-node-motifs",
  "dataset": {
    "name": "ColiNet 1.0 E. coli transcription network without autoregulation",
    "nodeCount": 424,
    "edgeCount": 519,
    "totalConnectedTriads": 5188
  },
  "nullModel": {
    "trials": 1000,
    "description": "Per-node in/out/mutual-degree-preserving edge switching"
  },
  "publication": {
    "doi": "10.1126/science.298.5594.824",
    "url": "https://doi.org/10.1126/science.298.5594.824",
    "reportedFfl": "40 observed; 7 ± 3 null; Z = 10"
  },
  "comparison": {
    "publishedTopMotif": "030T",
    "observedFflMatchesPublished40": true,
    "onto2dTopMotif": "030T",
    "topRankingAgrees": true,
    "significantTriadsAtPublishedThreshold": [
      "030T"
    ],
    "onlyFflSignificant": true,
    "roundedNullResultCompatible": true,
    "publishedRoundedFfl": {
      "observed": 40,
      "nullMean": 7,
      "nullStandardDeviation": 3,
      "zScore": 10
    }
  },
  "motifs": [
    {
      "triadCode": "021D",
      "name": "Diverging dyad",
      "description": "One source points to two targets.",
      "edges": [
        [
          1,
          0
        ],
        [
          1,
          2
        ]
      ],
      "mfinderId": 6,
      "canonicalId": "sha256:7955f77edae9ab72165f0f79c68a8132cb6428ddc449651ec0a2f3841e02d854",
      "skeletonId": "sha256:0f9f553ac8b136d61f8297a909c949d11a1ee98e23718a0b6a8fb85b0994df0c",
      "observed": 4760,
      "nullMean": 4792.469,
      "nullStandardDeviation": 3.0666665036990497,
      "zScore": -10.587717953952788,
      "foldEnrichment": 0.9932249952999174,
      "relativeEnrichment": -0.006775004700082577,
      "empiricalUpperP": 1,
      "significant": false,
      "rank": 4,
      "significanceProfile": -0.5004660490827544
    },
    {
      "triadCode": "021U",
      "name": "Converging dyad",
      "description": "Two sources point to one target.",
      "edges": [
        [
          0,
          1
        ],
        [
          2,
          1
        ]
      ],
      "mfinderId": 36,
      "canonicalId": "sha256:8852743b2f6c41368903eb91583873f662edcb25d8dd44d74721ad0a04dcf6ad",
      "skeletonId": "sha256:0f9f553ac8b136d61f8297a909c949d11a1ee98e23718a0b6a8fb85b0994df0c",
      "observed": 226,
      "nullMean": 258.469,
      "nullStandardDeviation": 3.066666503459501,
      "zScore": -10.587717954779816,
      "foldEnrichment": 0.8743795194007792,
      "relativeEnrichment": -0.12562048059922076,
      "empiricalUpperP": 1,
      "significant": false,
      "rank": 5,
      "significanceProfile": -0.5004660491218468
    },
    {
      "triadCode": "021C",
      "name": "Directed chain",
      "description": "A two-step directed path.",
      "edges": [
        [
          0,
          1
        ],
        [
          1,
          2
        ]
      ],
      "mfinderId": 12,
      "canonicalId": "sha256:b6c1f7853a4981f9434efa51f9dca5d9b9856678ea7a77753fe91d7039c50115",
      "skeletonId": "sha256:0f9f553ac8b136d61f8297a909c949d11a1ee98e23718a0b6a8fb85b0994df0c",
      "observed": 162,
      "nullMean": 194.418,
      "nullStandardDeviation": 3.0735521343753485,
      "zScore": -10.54740527659488,
      "foldEnrichment": 0.8332561799833349,
      "relativeEnrichment": -0.16674382001666516,
      "empiricalUpperP": 1,
      "significant": false,
      "rank": 3,
      "significanceProfile": -0.49856052737798245
    },
    {
      "triadCode": "111D",
      "name": "Mutual dyad with incoming edge",
      "description": "A mutual pair receives one additional edge.",
      "edges": [
        [
          0,
          2
        ],
        [
          2,
          0
        ],
        [
          1,
          2
        ]
      ],
      "mfinderId": 74,
      "canonicalId": "sha256:05b5d56a81732feee8a2bf3a3e3386f681c286df860dd3eab69ac932b07f4a17",
      "skeletonId": "sha256:0f9f553ac8b136d61f8297a909c949d11a1ee98e23718a0b6a8fb85b0994df0c",
      "observed": 0,
      "nullMean": 0,
      "nullStandardDeviation": 0,
      "zScore": null,
      "foldEnrichment": null,
      "relativeEnrichment": null,
      "empiricalUpperP": 1,
      "significant": false,
      "rank": 6,
      "significanceProfile": null
    },
    {
      "triadCode": "111U",
      "name": "Mutual dyad with outgoing edge",
      "description": "A mutual pair emits one additional edge.",
      "edges": [
        [
          0,
          2
        ],
        [
          2,
          0
        ],
        [
          2,
          1
        ]
      ],
      "mfinderId": 14,
      "canonicalId": "sha256:efd052a7137cff9a89b440e7d5507a79e834cf37ce5b4a4d45b878612642f63f",
      "skeletonId": "sha256:0f9f553ac8b136d61f8297a909c949d11a1ee98e23718a0b6a8fb85b0994df0c",
      "observed": 0,
      "nullMean": 0,
      "nullStandardDeviation": 0,
      "zScore": null,
      "foldEnrichment": null,
      "relativeEnrichment": null,
      "empiricalUpperP": 1,
      "significant": false,
      "rank": 12,
      "significanceProfile": null
    },
    {
      "triadCode": "030T",
      "name": "Feed-forward loop",
      "description": "A source regulates a target both directly and through an intermediate.",
      "edges": [
        [
          0,
          1
        ],
        [
          2,
          1
        ],
        [
          0,
          2
        ]
      ],
      "mfinderId": 38,
      "canonicalId": "sha256:0f578d7e0e573cc770fb189913486f1c0461a8aeebf83e6cdc7ac3d2208d0fea",
      "skeletonId": "sha256:9be4ec8a7a5f4bca5008180fc8a6dff4b90b7f7a7f5939b3a45745e45675e517",
      "observed": 40,
      "nullMean": 7.531,
      "nullStandardDeviation": 3.066666503459977,
      "zScore": 10.587717954778174,
      "foldEnrichment": 5.311379630859116,
      "relativeEnrichment": 4.311379630859116,
      "empiricalUpperP": 0,
      "significant": true,
      "rank": 1,
      "significanceProfile": 0.5004660491217692
    },
    {
      "triadCode": "030C",
      "name": "Directed 3-cycle",
      "description": "Three edges form a directed cycle.",
      "edges": [
        [
          1,
          0
        ],
        [
          2,
          1
        ],
        [
          0,
          2
        ]
      ],
      "mfinderId": 98,
      "canonicalId": "sha256:913c5005d5ac33efaae366360c36c6f2bdfae29f0e86807b7074cf18d5a18f63",
      "skeletonId": "sha256:9be4ec8a7a5f4bca5008180fc8a6dff4b90b7f7a7f5939b3a45745e45675e517",
      "observed": 0,
      "nullMean": 0.017,
      "nullStandardDeviation": 0.1293357171384909,
      "zScore": -0.13144087631877152,
      "foldEnrichment": 0,
      "relativeEnrichment": -1,
      "empiricalUpperP": 1,
      "significant": false,
      "rank": 2,
      "significanceProfile": -0.006213019306457045
    },
    {
      "triadCode": "201",
      "name": "Two mutual dyads",
      "description": "One node participates in two mutual pairs.",
      "edges": [
        [
          0,
          1
        ],
        [
          1,
          0
        ],
        [
          0,
          2
        ],
        [
          2,
          0
        ]
      ],
      "mfinderId": 78,
      "canonicalId": "sha256:2148cbb7d22e25d1cd150e6f6fd75a154e897faefeaec676a5bc122f6b9fd082",
      "skeletonId": "sha256:0f9f553ac8b136d61f8297a909c949d11a1ee98e23718a0b6a8fb85b0994df0c",
      "observed": 0,
      "nullMean": 0,
      "nullStandardDeviation": 0,
      "zScore": null,
      "foldEnrichment": null,
      "relativeEnrichment": null,
      "empiricalUpperP": 1,
      "significant": false,
      "rank": 7,
      "significanceProfile": null
    },
    {
      "triadCode": "120D",
      "name": "Mutual dyad with common source",
      "description": "Both nodes of a mutual pair point to the third node.",
      "edges": [
        [
          1,
          2
        ],
        [
          1,
          0
        ],
        [
          0,
          2
        ],
        [
          2,
          0
        ]
      ],
      "mfinderId": 108,
      "canonicalId": "sha256:53bce327387dec281c5f71b47a8a2b46d43cad339fc9228fb637ce4877a7d189",
      "skeletonId": "sha256:9be4ec8a7a5f4bca5008180fc8a6dff4b90b7f7a7f5939b3a45745e45675e517",
      "observed": 0,
      "nullMean": 0,
      "nullStandardDeviation": 0,
      "zScore": null,
      "foldEnrichment": null,
      "relativeEnrichment": null,
      "empiricalUpperP": 1,
      "significant": false,
      "rank": 10,
      "significanceProfile": null
    },
    {
      "triadCode": "120U",
      "name": "Mutual dyad with common target",
      "description": "The third node points to both nodes of a mutual pair.",
      "edges": [
        [
          0,
          1
        ],
        [
          2,
          1
        ],
        [
          0,
          2
        ],
        [
          2,
          0
        ]
      ],
      "mfinderId": 46,
      "canonicalId": "sha256:4a245f24065c1667653d51ed54050871023bb0622889cf8ec899bd838545dbc2",
      "skeletonId": "sha256:9be4ec8a7a5f4bca5008180fc8a6dff4b90b7f7a7f5939b3a45745e45675e517",
      "observed": 0,
      "nullMean": 0,
      "nullStandardDeviation": 0,
      "zScore": null,
      "foldEnrichment": null,
      "relativeEnrichment": null,
      "empiricalUpperP": 1,
      "significant": false,
      "rank": 9,
      "significanceProfile": null
    },
    {
      "triadCode": "120C",
      "name": "Mutual dyad in a directed cycle",
      "description": "A mutual pair sits inside a directed three-cycle.",
      "edges": [
        [
          0,
          1
        ],
        [
          1,
          2
        ],
        [
          0,
          2
        ],
        [
          2,
          0
        ]
      ],
      "mfinderId": 102,
      "canonicalId": "sha256:f9dd4dd1d541a38bdb14f8a1e0a2fad47d1064f517e3f22df4bc4e7ed85487d3",
      "skeletonId": "sha256:9be4ec8a7a5f4bca5008180fc8a6dff4b90b7f7a7f5939b3a45745e45675e517",
      "observed": 0,
      "nullMean": 0,
      "nullStandardDeviation": 0,
      "zScore": null,
      "foldEnrichment": null,
      "relativeEnrichment": null,
      "empiricalUpperP": 1,
      "significant": false,
      "rank": 13,
      "significanceProfile": null
    },
    {
      "triadCode": "210",
      "name": "Two mutual dyads plus one edge",
      "description": "Two mutual pairs are joined by one additional directed edge.",
      "edges": [
        [
          0,
          1
        ],
        [
          1,
          2
        ],
        [
          2,
          1
        ],
        [
          0,
          2
        ],
        [
          2,
          0
        ]
      ],
      "mfinderId": 110,
      "canonicalId": "sha256:b8164c3a118efd080ea4a8d353542b8e8af6745edc461df2f552903dddde680a",
      "skeletonId": "sha256:9be4ec8a7a5f4bca5008180fc8a6dff4b90b7f7a7f5939b3a45745e45675e517",
      "observed": 0,
      "nullMean": 0,
      "nullStandardDeviation": 0,
      "zScore": null,
      "foldEnrichment": null,
      "relativeEnrichment": null,
      "empiricalUpperP": 1,
      "significant": false,
      "rank": 11,
      "significanceProfile": null
    },
    {
      "triadCode": "300",
      "name": "Fully mutual triad",
      "description": "Every pair is connected in both directions.",
      "edges": [
        [
          0,
          1
        ],
        [
          1,
          0
        ],
        [
          1,
          2
        ],
        [
          2,
          1
        ],
        [
          0,
          2
        ],
        [
          2,
          0
        ]
      ],
      "mfinderId": 238,
      "canonicalId": "sha256:3ba6bedd24344af7a9c134cf2b24ef145ce3531395d3904150803e678f8ca6b9",
      "skeletonId": "sha256:9be4ec8a7a5f4bca5008180fc8a6dff4b90b7f7a7f5939b3a45745e45675e517",
      "observed": 0,
      "nullMean": 0,
      "nullStandardDeviation": 0,
      "zScore": null,
      "foldEnrichment": null,
      "relativeEnrichment": null,
      "empiricalUpperP": 1,
      "significant": false,
      "rank": 8,
      "significanceProfile": null
    }
  ]
});
