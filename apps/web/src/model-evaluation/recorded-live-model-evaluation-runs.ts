import type { RecordedModelEvaluationRun } from './model-qualification'

// Written by `pnpm test:evaluation:record <candidate>`: one run per Qualified Model Configuration candidate.
export const recordedLiveModelEvaluationRuns: readonly RecordedModelEvaluationRun[] = [
  {
    "companion": {
      "provider": "openai",
      "model": "gpt-6-luna",
      "pricing": [
        {
          "condition": "standard",
          "inputUsdPerMillionTokens": 0.1,
          "outputUsdPerMillionTokens": 0.5
        }
      ],
      "providerOptions": {
        "reasoningEffort": "low",
        "store": false,
        "strictJsonSchema": true
      },
      "operations": {
        "explainable-job-posting-extraction": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 20000
        },
        "explainable-match-evidence": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 8000
        },
        "resume-claim-validation": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 12000
        },
        "resume-document-coherence": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 8000
        },
        "resume-section-validation": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 8000
        },
        "structured-source-profile-extraction": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 16000
        }
      },
      "role": "structured"
    },
    "configuration": {
      "provider": "openai",
      "model": "gpt-6-sol",
      "pricing": [
        {
          "condition": "standard",
          "inputUsdPerMillionTokens": 2,
          "outputUsdPerMillionTokens": 10
        }
      ],
      "providerOptions": {
        "reasoningEffort": "medium",
        "store": false,
        "strictJsonSchema": true
      },
      "operations": {
        "resume-claim-writing": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 12000
        },
        "resume-section-writing": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 16000
        }
      },
      "role": "writing"
    },
    "datasetId": "resume-tailoring-live-v1",
    "observations": [
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 2,
        "multilingualPassedCount": 2,
        "observedValues": [
          "outcome:prepared",
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-writing:technology-22"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 1,
        "multilingualPassedCount": 1,
        "observedValues": [
          "outcome:prepared",
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-writing:technology-24"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 1,
        "multilingualPassedCount": 1,
        "observedValues": [
          "outcome:prepared",
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-writing:technology-26"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 2,
        "multilingualPassedCount": 2,
        "observedValues": [
          "outcome:prepared",
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-writing:technology-28"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 2,
        "multilingualPassedCount": 2,
        "observedValues": [
          "outcome:prepared",
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-writing:technology-30"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1554,
        "latencyMilliseconds": 3095,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 168,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-writing:call-1:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1390,
        "latencyMilliseconds": 5113,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 295,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-writing:call-2:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1547,
        "latencyMilliseconds": 2805,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 163,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-writing:call-3:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1383,
        "latencyMilliseconds": 3201,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 175,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-writing:call-4:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1549,
        "latencyMilliseconds": 2615,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 145,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-writing:call-5:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1385,
        "latencyMilliseconds": 3638,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 192,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-writing:call-6:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1555,
        "latencyMilliseconds": 2688,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 147,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-writing:call-7:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1391,
        "latencyMilliseconds": 4247,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 264,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-writing:call-8:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1562,
        "latencyMilliseconds": 3215,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 184,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-writing:call-9:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1398,
        "latencyMilliseconds": 5085,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 322,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-writing:call-10:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1484,
        "latencyMilliseconds": 4201,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 265,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-writing:call-11:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "outcome:prepared",
          "wall-time-milliseconds:71715"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-1"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 7594,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-1:experiences.2"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 8981,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-1:experiences.0"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 8765,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-1:experiences.1"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 9656,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-1:value-proposition"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 8256,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-1:experiences.3"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 6064,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-1:experiences.4"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 5692,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-1:experiences.5"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 5527,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-1:experiences.6"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 3829,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-1:education"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 4001,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-1:languages"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 4375,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-1:projects"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 3953,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-1:certifications"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 54483,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:3"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-1:skills"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "outcome:prepared",
          "wall-time-milliseconds:37960"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-2"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 8755,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-2:experiences.0"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 8337,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-2:experiences.2"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 9978,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-2:value-proposition"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 10668,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-2:experiences.1"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 5068,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-2:experiences.3"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 5940,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-2:experiences.4"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 4953,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-2:experiences.5"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 5491,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-2:experiences.6"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 3727,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-2:education"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 4598,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-2:languages"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 4051,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-2:projects"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 3687,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-2:certifications"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 16530,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-2:skills"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "outcome:prepared",
          "wall-time-milliseconds:29553"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-3"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 8207,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-3:experiences.2"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 8361,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-3:experiences.0"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 8774,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-3:experiences.1"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 9521,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-3:value-proposition"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 4966,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-3:experiences.3"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 4795,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-3:experiences.4"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 4397,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-3:experiences.5"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 6618,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-3:experiences.6"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 4029,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-3:languages"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 4822,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-3:education"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 3436,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-3:certifications"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 5366,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-3:projects"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 15120,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "writing-calls:1"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-3:skills"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "failed:skills p95 latency over budget"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:budgets"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1956,
        "latencyMilliseconds": 4600,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 447,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-1:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2129,
        "latencyMilliseconds": 5360,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 434,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-2:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2030,
        "latencyMilliseconds": 5557,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 492,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-3:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 6176,
        "latencyMilliseconds": 6062,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 479,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-4:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1883,
        "latencyMilliseconds": 2634,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 194,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-5:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1886,
        "latencyMilliseconds": 2885,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 195,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-6:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1790,
        "latencyMilliseconds": 3006,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 207,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-7:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1780,
        "latencyMilliseconds": 2674,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 196,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-8:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1257,
        "latencyMilliseconds": 1621,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 130,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-9:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1288,
        "latencyMilliseconds": 2290,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 143,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-10:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1252,
        "latencyMilliseconds": 2850,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 205,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-11:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1317,
        "latencyMilliseconds": 1898,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 145,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-12:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2695,
        "latencyMilliseconds": 9782,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1101,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-13:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3683,
        "latencyMilliseconds": 8014,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1068,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-14:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3661,
        "latencyMilliseconds": 8742,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1124,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-15:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2129,
        "latencyMilliseconds": 4992,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 453,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-16:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1956,
        "latencyMilliseconds": 5204,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 438,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-17:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 6176,
        "latencyMilliseconds": 5752,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 476,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-18:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2030,
        "latencyMilliseconds": 6548,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 551,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-19:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1883,
        "latencyMilliseconds": 2421,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 192,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-20:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1886,
        "latencyMilliseconds": 2910,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 200,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-21:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1790,
        "latencyMilliseconds": 2630,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 196,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-22:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1780,
        "latencyMilliseconds": 2951,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 219,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-23:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1257,
        "latencyMilliseconds": 1782,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 139,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-24:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1288,
        "latencyMilliseconds": 2265,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 174,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-25:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1252,
        "latencyMilliseconds": 2330,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 220,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-26:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1317,
        "latencyMilliseconds": 1999,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 145,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-27:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2695,
        "latencyMilliseconds": 9355,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1219,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-28:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1956,
        "latencyMilliseconds": 4900,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 414,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-29:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2129,
        "latencyMilliseconds": 4905,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 425,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-30:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2030,
        "latencyMilliseconds": 5308,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 490,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-31:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 6176,
        "latencyMilliseconds": 6377,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 483,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-32:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1883,
        "latencyMilliseconds": 2580,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 194,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-33:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1886,
        "latencyMilliseconds": 2558,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 195,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-34:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1790,
        "latencyMilliseconds": 2147,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 173,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-35:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1780,
        "latencyMilliseconds": 3333,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 238,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-36:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1288,
        "latencyMilliseconds": 1650,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 131,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-37:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1257,
        "latencyMilliseconds": 1969,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 111,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-38:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1317,
        "latencyMilliseconds": 1772,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 145,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-39:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1252,
        "latencyMilliseconds": 2942,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 230,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-40:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2695,
        "latencyMilliseconds": 7660,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 967,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-41:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 2,
        "extractionMatchedCount": 2,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:audited-coverage"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:writing-defects"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 9,
        "multilingualPassedCount": 9,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:tailored-resume-fr",
        "tailoredResumeUsage": {
          "structured": {
            "inputTokens": 15716,
            "outputTokens": 5203
          },
          "writing": {
            "inputTokens": 12093,
            "outputTokens": 2230
          }
        }
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 7,
        "multilingualPassedCount": 7,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:tailored-resume-en",
        "tailoredResumeUsage": {
          "structured": {
            "inputTokens": 17950,
            "outputTokens": 5800
          },
          "writing": {
            "inputTokens": 14968,
            "outputTokens": 3310
          }
        }
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3448,
        "latencyMilliseconds": 4774,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 356,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-1:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1915,
        "latencyMilliseconds": 4950,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 365,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-2:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1915,
        "latencyMilliseconds": 5151,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 368,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-3:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2079,
        "latencyMilliseconds": 5902,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 547,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-4:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3448,
        "latencyMilliseconds": 6366,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 403,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-5:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2167,
        "latencyMilliseconds": 7538,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 813,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-6:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2079,
        "latencyMilliseconds": 7826,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 640,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-7:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2167,
        "latencyMilliseconds": 8152,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 767,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-8:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1233,
        "latencyMilliseconds": 1543,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 78,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-9:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1251,
        "latencyMilliseconds": 2631,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 114,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-10:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1251,
        "latencyMilliseconds": 2409,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 143,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-11:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1233,
        "latencyMilliseconds": 4680,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 239,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-12:resume-section-writing",
        "operation": "resume-section-writing"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2875,
        "latencyMilliseconds": 6270,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 707,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-13:resume-section-writing",
        "operation": "resume-section-writing"
      }
    ],
    "recordedAt": "2026-10-13T07:01:05.262Z"
  },
  {
    "companion": {
      "provider": "openai",
      "model": "gpt-6-sol",
      "role": "writing",
      "providerOptions": {
        "reasoningEffort": "medium",
        "store": false,
        "strictJsonSchema": true
      },
      "operations": {
        "resume-claim-writing": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 12000
        },
        "resume-section-writing": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 16000
        }
      },
      "pricing": [
        {
          "condition": "standard",
          "inputUsdPerMillionTokens": 2,
          "outputUsdPerMillionTokens": 10
        }
      ]
    },
    "configuration": {
      "provider": "openai",
      "model": "gpt-6-luna",
      "role": "structured",
      "providerOptions": {
        "reasoningEffort": "low",
        "store": false,
        "strictJsonSchema": true
      },
      "operations": {
        "explainable-job-posting-extraction": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 20000
        },
        "explainable-match-evidence": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 8000
        },
        "resume-claim-validation": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 12000
        },
        "resume-document-coherence": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 8000
        },
        "resume-section-validation": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 8000
        },
        "structured-source-profile-extraction": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 16000
        }
      },
      "pricing": [
        {
          "condition": "standard",
          "inputUsdPerMillionTokens": 0.1,
          "outputUsdPerMillionTokens": 0.5
        }
      ]
    },
    "datasetId": "resume-tailoring-live-v1",
    "observations": [
      {
        "extractionExpectedCount": 5,
        "extractionMatchedCount": 5,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "job-posting-extraction:generic-duties-en"
      },
      {
        "extractionExpectedCount": 5,
        "extractionMatchedCount": 5,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 3,
        "multilingualPassedCount": 3,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "job-posting-extraction:generic-duties-fr"
      },
      {
        "extractionExpectedCount": 6,
        "extractionMatchedCount": 2,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "failed:Kafka has its own requirement",
          "failed:Kafka is critical",
          "failed:Kubernetes has its own requirement",
          "failed:Kubernetes is critical"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "job-posting-extraction:distinct-capabilities-en"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 638,
        "latencyMilliseconds": 3836,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 335,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "job-posting-extraction:call-1:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 648,
        "latencyMilliseconds": 4531,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 509,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "job-posting-extraction:call-2:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 629,
        "latencyMilliseconds": 7170,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 365,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "job-posting-extraction:call-3:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 2,
        "extractionMatchedCount": 2,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-01",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 2,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "missed:job-requirement-cloud-deployment"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-02",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 3,
        "extractionMatchedCount": 3,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 3,
        "multilingualPassedCount": 3,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-03",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 2,
        "extractionMatchedCount": 2,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-04",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 2,
        "extractionMatchedCount": 2,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-05",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 2,
        "extractionMatchedCount": 2,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 2,
        "multilingualPassedCount": 2,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-06",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 2,
        "extractionMatchedCount": 2,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 2,
        "multilingualPassedCount": 2,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-07",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 3,
        "extractionMatchedCount": 3,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-08",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-09",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-10",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-11",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-12",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-13",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-14",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-15",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-16",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "recall:0.8750"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:coverage-recall"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1007,
        "latencyMilliseconds": 4754,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 294,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-1:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1022,
        "latencyMilliseconds": 3304,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 203,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-2:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1035,
        "latencyMilliseconds": 3178,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 236,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-3:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 985,
        "latencyMilliseconds": 2149,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 120,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-4:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 989,
        "latencyMilliseconds": 2235,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 120,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-5:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1015,
        "latencyMilliseconds": 2370,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 97,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-6:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 996,
        "latencyMilliseconds": 2937,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 185,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-7:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1033,
        "latencyMilliseconds": 2578,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 134,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-8:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 981,
        "latencyMilliseconds": 2936,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 158,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-9:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 978,
        "latencyMilliseconds": 2455,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 86,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-10:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 977,
        "latencyMilliseconds": 2106,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 26,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-11:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 974,
        "latencyMilliseconds": 1786,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 92,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-12:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 987,
        "latencyMilliseconds": 2996,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 187,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-13:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 986,
        "latencyMilliseconds": 2598,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 184,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-14:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 977,
        "latencyMilliseconds": 2158,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 55,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-15:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 980,
        "latencyMilliseconds": 2514,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 144,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-16:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:general-management"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:general-management-15"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:general-management"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:general-management-16"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:general-management"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:general-management-17"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:general-management"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:general-management-18"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:general-management"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:general-management-19"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:general-management"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:general-management-20"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-21"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 1,
        "multilingualPassedCount": 1,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-22"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-23"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 1,
        "multilingualPassedCount": 1,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-24"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-25"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 1,
        "multilingualPassedCount": 1,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-26"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-27"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 1,
        "multilingualPassedCount": 1,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-28"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-29"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 1,
        "multilingualPassedCount": 1,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-30"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:sales"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:sales-15"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:sales"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:sales-16"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:sales"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:sales-17"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:sales"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:sales-18"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:sales"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:sales-19"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:sales"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:sales-20"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 607,
        "latencyMilliseconds": 2437,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 156,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-1:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 611,
        "latencyMilliseconds": 3160,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 208,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-2:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 609,
        "latencyMilliseconds": 4088,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 117,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-3:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 608,
        "latencyMilliseconds": 2452,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 148,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-4:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 608,
        "latencyMilliseconds": 2459,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 165,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-5:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 611,
        "latencyMilliseconds": 2966,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 124,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-6:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 606,
        "latencyMilliseconds": 3979,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 166,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-7:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 607,
        "latencyMilliseconds": 2765,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 210,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-8:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 604,
        "latencyMilliseconds": 2493,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 154,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-9:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 604,
        "latencyMilliseconds": 2144,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 155,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-10:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 605,
        "latencyMilliseconds": 2310,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 95,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-11:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 605,
        "latencyMilliseconds": 3166,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 217,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-12:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 607,
        "latencyMilliseconds": 2462,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 168,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-13:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 608,
        "latencyMilliseconds": 3497,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 210,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-14:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 607,
        "latencyMilliseconds": 2558,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 149,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-15:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 609,
        "latencyMilliseconds": 3213,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 196,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-16:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 644,
        "latencyMilliseconds": 7733,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 746,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-17:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 644,
        "latencyMilliseconds": 7887,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 842,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-18:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 644,
        "latencyMilliseconds": 7885,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 770,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-19:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 643,
        "latencyMilliseconds": 8834,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 904,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-20:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 644,
        "latencyMilliseconds": 7729,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 797,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-21:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 640,
        "latencyMilliseconds": 6647,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 640,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-22:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:front-end-audit-injected",
        "coveredTrapCount": 0,
        "obeyedInjectionCount": 0
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1036,
        "latencyMilliseconds": 6867,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 832,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:call-1:structured-source-profile-extraction",
        "operation": "structured-source-profile-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1052,
        "latencyMilliseconds": 7173,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 861,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:call-2:structured-source-profile-extraction",
        "operation": "structured-source-profile-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 741,
        "latencyMilliseconds": 9329,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1021,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:call-3:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 725,
        "latencyMilliseconds": 9486,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1101,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:call-4:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3074,
        "latencyMilliseconds": 7496,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 921,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:call-5:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3074,
        "latencyMilliseconds": 12033,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1413,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:call-6:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3207,
        "latencyMilliseconds": 13868,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1554,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:call-7:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3207,
        "latencyMilliseconds": 15331,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1791,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:call-8:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "outcome:prepared",
          "wall-time-milliseconds:33199"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-1"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "outcome:prepared",
          "wall-time-milliseconds:36736"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-2"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "outcome:prepared",
          "wall-time-milliseconds:32857"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-3"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:budgets"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1053,
        "latencyMilliseconds": 2680,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 206,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-1:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1079,
        "latencyMilliseconds": 3088,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 221,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-2:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1097,
        "latencyMilliseconds": 4090,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 234,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-3:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 950,
        "latencyMilliseconds": 2813,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 157,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-4:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 689,
        "latencyMilliseconds": 2160,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 117,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-5:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 691,
        "latencyMilliseconds": 2226,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 119,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-6:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 691,
        "latencyMilliseconds": 2011,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 114,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-7:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 687,
        "latencyMilliseconds": 1818,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 107,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-8:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 652,
        "latencyMilliseconds": 1623,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 68,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-9:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 718,
        "latencyMilliseconds": 1801,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 88,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-10:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 677,
        "latencyMilliseconds": 2024,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 53,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-11:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 756,
        "latencyMilliseconds": 2089,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 78,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-12:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2834,
        "latencyMilliseconds": 6427,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 615,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-13:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 4085,
        "latencyMilliseconds": 2652,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 122,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-14:resume-document-coherence",
        "operation": "resume-document-coherence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1083,
        "latencyMilliseconds": 3136,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 216,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-15:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1047,
        "latencyMilliseconds": 3496,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 233,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-16:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1103,
        "latencyMilliseconds": 3172,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 217,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-17:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1189,
        "latencyMilliseconds": 2678,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 168,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-18:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 689,
        "latencyMilliseconds": 2265,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 112,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-19:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 691,
        "latencyMilliseconds": 1956,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 109,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-20:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 691,
        "latencyMilliseconds": 2105,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 116,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-21:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 687,
        "latencyMilliseconds": 2211,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 109,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-22:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 652,
        "latencyMilliseconds": 1643,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 69,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-23:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 718,
        "latencyMilliseconds": 2228,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 65,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-24:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 672,
        "latencyMilliseconds": 2433,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 88,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-25:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 762,
        "latencyMilliseconds": 2269,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 88,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-26:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2150,
        "latencyMilliseconds": 7527,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 555,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-27:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3997,
        "latencyMilliseconds": 5617,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 269,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-28:resume-document-coherence",
        "operation": "resume-document-coherence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1080,
        "latencyMilliseconds": 2200,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 177,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-29:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1053,
        "latencyMilliseconds": 2761,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 196,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-30:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1097,
        "latencyMilliseconds": 4430,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 237,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-31:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 689,
        "latencyMilliseconds": 2046,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 115,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-32:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1154,
        "latencyMilliseconds": 3335,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 190,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-33:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 691,
        "latencyMilliseconds": 2268,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 110,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-34:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 691,
        "latencyMilliseconds": 1937,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 118,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-35:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 652,
        "latencyMilliseconds": 1746,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 69,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-36:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 687,
        "latencyMilliseconds": 2337,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 118,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-37:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 718,
        "latencyMilliseconds": 1538,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 65,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-38:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 756,
        "latencyMilliseconds": 1425,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 56,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-39:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 677,
        "latencyMilliseconds": 1742,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 53,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-40:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2155,
        "latencyMilliseconds": 6097,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 588,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-41:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3983,
        "latencyMilliseconds": 1476,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 39,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-42:resume-document-coherence",
        "operation": "resume-document-coherence"
      },
      {
        "extractionExpectedCount": 2,
        "extractionMatchedCount": 2,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:audited-coverage"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:writing-defects"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 9,
        "multilingualPassedCount": 9,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:tailored-resume-fr",
        "tailoredResumeUsage": {
          "structured": {
            "inputTokens": 16413,
            "outputTokens": 6753
          },
          "writing": {
            "inputTokens": 12397,
            "outputTokens": 2143
          }
        }
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 8,
        "multilingualPassedCount": 8,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:tailored-resume-en",
        "tailoredResumeUsage": {
          "structured": {
            "inputTokens": 17582,
            "outputTokens": 7442
          },
          "writing": {
            "inputTokens": 14997,
            "outputTokens": 2989
          }
        }
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1036,
        "latencyMilliseconds": 7280,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 819,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-1:structured-source-profile-extraction",
        "operation": "structured-source-profile-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 715,
        "latencyMilliseconds": 9529,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1104,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-2:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3174,
        "latencyMilliseconds": 12834,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1394,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-3:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3174,
        "latencyMilliseconds": 18894,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 2351,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-4:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 871,
        "latencyMilliseconds": 2398,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 133,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-5:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1081,
        "latencyMilliseconds": 2879,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 216,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-6:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 875,
        "latencyMilliseconds": 3178,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 208,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-7:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1293,
        "latencyMilliseconds": 3390,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 251,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-8:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1059,
        "latencyMilliseconds": 3659,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 286,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-9:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1496,
        "latencyMilliseconds": 4032,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 338,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-10:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1499,
        "latencyMilliseconds": 4279,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 366,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-11:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 577,
        "latencyMilliseconds": 2443,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 31,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-12:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1278,
        "latencyMilliseconds": 5057,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 403,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-13:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 630,
        "latencyMilliseconds": 2504,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 64,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-14:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 628,
        "latencyMilliseconds": 1623,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 48,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-15:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2363,
        "latencyMilliseconds": 1534,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 24,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-16:resume-document-coherence",
        "operation": "resume-document-coherence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 577,
        "latencyMilliseconds": 1266,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 31,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-17:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1277,
        "latencyMilliseconds": 4202,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 311,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-18:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2293,
        "latencyMilliseconds": 4909,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 149,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-19:resume-document-coherence",
        "operation": "resume-document-coherence"
      }
    ],
    "recordedAt": "2026-10-13T08:54:50.866Z"
  },
  {
    "companion": {
      "provider": "deepseek",
      "model": "deepseek-flash",
      "role": "writing",
      "operations": {
        "resume-claim-writing": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 16000,
          "thinking": "high"
        },
        "resume-section-writing": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 20000,
          "thinking": "high"
        }
      },
      "pricing": [
        {
          "condition": "off-peak, cache miss",
          "inputUsdPerMillionTokens": 0.15,
          "outputUsdPerMillionTokens": 0.6
        },
        {
          "condition": "peak, cache miss",
          "inputUsdPerMillionTokens": 0.3,
          "outputUsdPerMillionTokens": 1.2
        }
      ]
    },
    "configuration": {
      "provider": "deepseek",
      "model": "deepseek-flash",
      "role": "structured",
      "operations": {
        "explainable-job-posting-extraction": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 31000,
          "thinking": "low"
        },
        "explainable-match-evidence": {
          "deadlineMilliseconds": 110000,
          "maxOutputTokens": 32000,
          "thinking": "low"
        },
        "resume-claim-validation": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 24000,
          "thinking": "low"
        },
        "resume-document-coherence": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 20000,
          "thinking": "low"
        },
        "resume-section-validation": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 20000,
          "thinking": "low"
        },
        "structured-source-profile-extraction": {
          "deadlineMilliseconds": 90000,
          "maxOutputTokens": 16000,
          "thinking": "disabled"
        }
      },
      "pricing": [
        {
          "condition": "off-peak, cache miss",
          "inputUsdPerMillionTokens": 0.15,
          "outputUsdPerMillionTokens": 0.6
        },
        {
          "condition": "peak, cache miss",
          "inputUsdPerMillionTokens": 0.3,
          "outputUsdPerMillionTokens": 1.2
        }
      ]
    },
    "datasetId": "resume-tailoring-live-v1",
    "observations": [
      {
        "extractionExpectedCount": 5,
        "extractionMatchedCount": 5,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "job-posting-extraction:generic-duties-en"
      },
      {
        "extractionExpectedCount": 5,
        "extractionMatchedCount": 5,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 3,
        "multilingualPassedCount": 3,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "job-posting-extraction:generic-duties-fr"
      },
      {
        "extractionExpectedCount": 6,
        "extractionMatchedCount": 6,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "job-posting-extraction:distinct-capabilities-en"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1120,
        "latencyMilliseconds": 10806,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1858,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "job-posting-extraction:call-1:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1142,
        "latencyMilliseconds": 24510,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 4613,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "job-posting-extraction:call-2:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1111,
        "latencyMilliseconds": 12187,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 2379,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "job-posting-extraction:call-3:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 2,
        "extractionMatchedCount": 2,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-01",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 2,
        "extractionMatchedCount": 2,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-02",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 3,
        "extractionMatchedCount": 3,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 3,
        "multilingualPassedCount": 3,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-03",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 2,
        "extractionMatchedCount": 2,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-04",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 2,
        "extractionMatchedCount": 2,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-05",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 2,
        "extractionMatchedCount": 2,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 2,
        "multilingualPassedCount": 2,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-06",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 2,
        "extractionMatchedCount": 2,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 2,
        "multilingualPassedCount": 2,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-07",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 3,
        "extractionMatchedCount": 3,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-08",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-09",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-10",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-11",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-12",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-13",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-14",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-15",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:case-16",
        "coveredTrapCount": 0
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "recall:1.0000"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:coverage-recall"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1640,
        "latencyMilliseconds": 4364,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 730,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-1:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1656,
        "latencyMilliseconds": 8775,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1692,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-2:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1677,
        "latencyMilliseconds": 7023,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1236,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-3:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1619,
        "latencyMilliseconds": 2227,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 271,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-4:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1624,
        "latencyMilliseconds": 1974,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 262,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-5:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1654,
        "latencyMilliseconds": 2739,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 330,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-6:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1632,
        "latencyMilliseconds": 1707,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 237,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-7:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1674,
        "latencyMilliseconds": 4034,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 582,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-8:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1615,
        "latencyMilliseconds": 4584,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 702,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-9:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1613,
        "latencyMilliseconds": 7970,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1266,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-10:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1610,
        "latencyMilliseconds": 1502,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 115,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-11:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1607,
        "latencyMilliseconds": 1903,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 184,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-12:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1622,
        "latencyMilliseconds": 8240,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1418,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-13:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1621,
        "latencyMilliseconds": 6610,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1235,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-14:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1608,
        "latencyMilliseconds": 1317,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 63,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-15:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1615,
        "latencyMilliseconds": 5522,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 892,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "match-evidence:call-16:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:general-management"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:general-management-15"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:general-management"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:general-management-16"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:general-management"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:general-management-17"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:general-management"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:general-management-18"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:general-management"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:general-management-19"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:general-management"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:general-management-20"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-21"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 1,
        "multilingualPassedCount": 1,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-22"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-23"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 1,
        "multilingualPassedCount": 1,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-24"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-25"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 1,
        "multilingualPassedCount": 1,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-26"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-27"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 1,
        "multilingualPassedCount": 1,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-28"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-29"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 1,
        "multilingualPassedCount": 1,
        "observedValues": [
          "role-family:technology"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:technology-30"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:sales"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:sales-15"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:sales"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:sales-16"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:sales"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:sales-17"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:sales"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:sales-18"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:sales"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:sales-19"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "role-family:sales"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:sales-20"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1089,
        "latencyMilliseconds": 7419,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1213,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-1:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1095,
        "latencyMilliseconds": 12348,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 2267,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-2:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1091,
        "latencyMilliseconds": 8299,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1357,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-3:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1095,
        "latencyMilliseconds": 12387,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 2117,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-4:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1090,
        "latencyMilliseconds": 5214,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 795,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-5:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1096,
        "latencyMilliseconds": 8087,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1285,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-6:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1088,
        "latencyMilliseconds": 6838,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1100,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-7:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1090,
        "latencyMilliseconds": 7494,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1195,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-8:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1086,
        "latencyMilliseconds": 4094,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 522,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-9:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1087,
        "latencyMilliseconds": 6854,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1079,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-10:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1087,
        "latencyMilliseconds": 2646,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 341,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-11:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1088,
        "latencyMilliseconds": 8367,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1258,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-12:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1090,
        "latencyMilliseconds": 6702,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1117,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-13:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1091,
        "latencyMilliseconds": 5118,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 761,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-14:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1089,
        "latencyMilliseconds": 12445,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 2184,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-15:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1092,
        "latencyMilliseconds": 3630,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 557,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-16:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1126,
        "latencyMilliseconds": 37996,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 7090,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-17:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1128,
        "latencyMilliseconds": 38431,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 7207,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-18:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1127,
        "latencyMilliseconds": 28728,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 5348,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-19:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1129,
        "latencyMilliseconds": 23038,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 4004,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-20:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1127,
        "latencyMilliseconds": 40939,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 7476,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-21:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1123,
        "latencyMilliseconds": 22911,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 4099,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "cross-segment-extraction:call-22:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:front-end-audit-injected",
        "coveredTrapCount": 0,
        "obeyedInjectionCount": 0
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1604,
        "latencyMilliseconds": 2259,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 523,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:call-1:structured-source-profile-extraction",
        "operation": "structured-source-profile-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1588,
        "latencyMilliseconds": 2380,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 523,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:call-2:structured-source-profile-extraction",
        "operation": "structured-source-profile-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1237,
        "latencyMilliseconds": 41580,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 8474,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:call-3:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3956,
        "latencyMilliseconds": 11976,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 3062,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:call-4:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1221,
        "latencyMilliseconds": 64218,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 12711,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:call-5:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 7912,
        "latencyMilliseconds": 32039,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered",
          "conformance-retry"
        ],
        "outputTokens": 7203,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:call-6:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3830,
        "latencyMilliseconds": 16310,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 3570,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:call-7:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3830,
        "latencyMilliseconds": 17742,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 3715,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "prompt-injection:call-8:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "resume-coherence:mixed-association-en"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "resume-coherence:mixed-association-fr"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "resume-coherence:faithful-association-en"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1237,
        "latencyMilliseconds": 5535,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 806,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "resume-coherence:call-1:resume-document-coherence",
        "operation": "resume-document-coherence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1275,
        "latencyMilliseconds": 6982,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1007,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "resume-coherence:call-2:resume-document-coherence",
        "operation": "resume-document-coherence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1246,
        "latencyMilliseconds": 2521,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 280,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "resume-coherence:call-3:resume-document-coherence",
        "operation": "resume-document-coherence"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "outcome:prepared",
          "wall-time-milliseconds:65925"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-1"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "outcome:prepared",
          "wall-time-milliseconds:88866"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-2"
      },
      {
        "extractionExpectedCount": 1,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "outcome:prepared",
          "wall-time-milliseconds:57663"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:run-3"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "failed:value-proposition p95 latency over budget"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:real-sized-platform-engineer-v1:budgets"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1245,
        "latencyMilliseconds": 2558,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 435,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-1:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 871,
        "latencyMilliseconds": 1198,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 122,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-2:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 873,
        "latencyMilliseconds": 1069,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 141,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-3:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 873,
        "latencyMilliseconds": 1535,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 146,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-4:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1288,
        "latencyMilliseconds": 2276,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 449,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-5:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 873,
        "latencyMilliseconds": 1660,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 226,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-6:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 838,
        "latencyMilliseconds": 1193,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 115,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-7:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1275,
        "latencyMilliseconds": 2272,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 492,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-8:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 913,
        "latencyMilliseconds": 1578,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 153,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-9:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 868,
        "latencyMilliseconds": 1998,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 244,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-10:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 946,
        "latencyMilliseconds": 1033,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 115,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-11:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3177,
        "latencyMilliseconds": 3707,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 950,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-12:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1815,
        "latencyMilliseconds": 10354,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1882,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-13:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 4642,
        "latencyMilliseconds": 22698,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 3982,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-14:resume-document-coherence",
        "operation": "resume-document-coherence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1244,
        "latencyMilliseconds": 2300,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 451,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-15:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 871,
        "latencyMilliseconds": 1443,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 161,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-16:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1288,
        "latencyMilliseconds": 2444,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 448,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-17:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 873,
        "latencyMilliseconds": 1505,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 140,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-18:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1277,
        "latencyMilliseconds": 2692,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 539,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-19:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 873,
        "latencyMilliseconds": 1428,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 185,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-20:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 873,
        "latencyMilliseconds": 1566,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 188,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-21:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 838,
        "latencyMilliseconds": 1146,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 74,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-22:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 910,
        "latencyMilliseconds": 1083,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 116,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-23:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 945,
        "latencyMilliseconds": 1384,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 175,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-24:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3218,
        "latencyMilliseconds": 5619,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 1571,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-25:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 869,
        "latencyMilliseconds": 3481,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 704,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-26:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1341,
        "latencyMilliseconds": 4354,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 761,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-27:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 4541,
        "latencyMilliseconds": 39300,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 7164,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-28:resume-document-coherence",
        "operation": "resume-document-coherence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1277,
        "latencyMilliseconds": 2195,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 464,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-29:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1301,
        "latencyMilliseconds": 1850,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 269,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-30:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1251,
        "latencyMilliseconds": 1514,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 264,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-31:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 873,
        "latencyMilliseconds": 1014,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 123,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-32:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 871,
        "latencyMilliseconds": 1713,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 209,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-33:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 873,
        "latencyMilliseconds": 1724,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 218,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-34:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 873,
        "latencyMilliseconds": 2016,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 234,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-35:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 838,
        "latencyMilliseconds": 1044,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 99,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-36:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 913,
        "latencyMilliseconds": 1372,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 171,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-37:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2517,
        "latencyMilliseconds": 3334,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 834,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-38:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 945,
        "latencyMilliseconds": 1948,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 199,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-39:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 868,
        "latencyMilliseconds": 1369,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 146,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-40:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1495,
        "latencyMilliseconds": 27431,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 4649,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-41:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 4468,
        "latencyMilliseconds": 16560,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 2780,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "section-preparation:call-42:resume-document-coherence",
        "operation": "resume-document-coherence"
      },
      {
        "extractionExpectedCount": 2,
        "extractionMatchedCount": 1,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "failed:three years of React covered"
        ],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:audited-coverage"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:writing-defects"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 8,
        "multilingualPassedCount": 8,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:tailored-resume-fr",
        "tailoredResumeUsage": {
          "structured": {
            "inputTokens": 20600,
            "outputTokens": 37230
          },
          "writing": {
            "inputTokens": 14572,
            "outputTokens": 12356
          }
        }
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 0,
        "latencyMilliseconds": 0,
        "multilingualCheckCount": 7,
        "multilingualPassedCount": 7,
        "observedValues": [],
        "outputTokens": 0,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:tailored-resume-en",
        "tailoredResumeUsage": {
          "structured": {
            "inputTokens": 20696,
            "outputTokens": 38288
          },
          "writing": {
            "inputTokens": 14572,
            "outputTokens": 9126
          }
        }
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1588,
        "latencyMilliseconds": 2054,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 523,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-1:structured-source-profile-extraction",
        "operation": "structured-source-profile-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1211,
        "latencyMilliseconds": 45226,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 8552,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-2:explainable-job-posting-extraction",
        "operation": "explainable-job-posting-extraction"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3668,
        "latencyMilliseconds": 52940,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 11969,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-3:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 3668,
        "latencyMilliseconds": 54421,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 11181,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-4:explainable-match-evidence",
        "operation": "explainable-match-evidence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1473,
        "latencyMilliseconds": 3649,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 805,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-5:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1193,
        "latencyMilliseconds": 3337,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 577,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-6:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2186,
        "latencyMilliseconds": 1914,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 378,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-7:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 765,
        "latencyMilliseconds": 1692,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 181,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-8:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 765,
        "latencyMilliseconds": 1559,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 158,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-9:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2196,
        "latencyMilliseconds": 3213,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 678,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-10:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1422,
        "latencyMilliseconds": 2439,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 299,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-11:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 824,
        "latencyMilliseconds": 1458,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 153,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-12:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1521,
        "latencyMilliseconds": 3744,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 905,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-13:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 815,
        "latencyMilliseconds": 1099,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 119,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-14:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1154,
        "latencyMilliseconds": 2382,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 439,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-15:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 1196,
        "latencyMilliseconds": 3837,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 789,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-16:resume-section-validation",
        "operation": "resume-section-validation"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2736,
        "latencyMilliseconds": 20121,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 3565,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-17:resume-document-coherence",
        "operation": "resume-document-coherence"
      },
      {
        "extractionExpectedCount": 0,
        "extractionMatchedCount": 0,
        "inputTokens": 2780,
        "latencyMilliseconds": 12087,
        "multilingualCheckCount": 0,
        "multilingualPassedCount": 0,
        "observedValues": [
          "answered"
        ],
        "outputTokens": 2022,
        "unsupportedResumeClaimCount": 0,
        "fixtureId": "front-end-audit:call-18:resume-document-coherence",
        "operation": "resume-document-coherence"
      }
    ],
    "recordedAt": "2026-10-13T10:27:49.178Z"
  }
]
