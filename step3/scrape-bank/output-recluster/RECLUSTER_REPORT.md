# Project-Based Re-Clustering v3 — Summary Report
> Generated: 2026-07-13T23:22:49.018Z
> Script: `cluster-project-based-v3.js`
> Method: Iterative cluster expansion from high-confidence seed pairs, with answer-category overlap as primary signal.

## Overview

| Metric | Value |
|--------|-------|
| Total bank | 4,852 |
| Locked Sets 1-20 | 800 |
| Available pool | 4,052 |
| **New sets produced** | **117** |
| Questions clustered | 1867 |
| Unclustered pool | 2185 |
| Set size range | 6-26 |
| Avg set size | 13 |

## Sample Clusters

### Set 21: trauma · copd/asthma · uti/pyelonephritis (26 Qs)
- Primary: 10, Mimic: 16
- Scene 1 "cough / fatigue / copd/asthma / pneumonia" — 7 Qs
- Scene 2 "trauma / back pain / meningitis/encephalitis / coagulopathy" — 6 Qs
- Scene 3 "dyspnea / palpitations / coagulopathy" — 5 Qs
- Scene 4 "nausea-vomiting / uti/pyelonephritis / coagulopathy" — 5 Qs
- Scene 5 "rash / urinary" — 3 Qs

### Set 22: coagulopathy · depression · heme (6 Qs)
- Primary: 4, Mimic: 2
- Scene 1 "coagulopathy / heme" — 4 Qs
- Scene 2 "thyroid / heme" — 2 Qs

### Set 23: coagulopathy · substance (6 Qs)
- Primary: 4, Mimic: 2
- Scene 1 "coagulopathy" — 4 Qs
- Scene 2 "substance / psychosis/schizo" — 2 Qs

### Set 24: fever · anemia · uti/pyelonephritis · heme (25 Qs)
- Primary: 8, Mimic: 17
- Scene 1 "fever / anemia / heme" — 7 Qs
- Scene 2 "fever / bleeding / uti/pyelonephritis / heme" — 7 Qs
- Scene 3 "fever / cough / ra/ctd / heme" — 7 Qs
- Scene 4 "fever / joint pain / mi/acs / ra/ctd / heme" — 4 Qs

### Set 25: ra/ctd · coagulopathy · neuro (8 Qs)
- Primary: 4, Mimic: 4
- Scene 1 "ra/ctd / anemia / neuro" — 5 Qs
- Scene 2 "coagulopathy / uti/pyelonephritis / neuro" — 3 Qs

### Set 26: headache · pe/dvt · coagulopathy (20 Qs)
- Primary: 8, Mimic: 12
- Scene 1 "headache / joint pain / coagulopathy" — 8 Qs
- Scene 2 "headache / nausea-vomiting" — 6 Qs
- Scene 3 "headache / nausea-vomiting" — 4 Qs
- Scene 4 "headache / edema / pe/dvt" — 2 Qs

### Set 27: coagulopathy · stroke · renal (8 Qs)
- Primary: 4, Mimic: 4
- Scene 1 "coagulopathy / pancreatitis / renal" — 6 Qs
- Scene 2 "uti/pyelonephritis / renal" — 2 Qs

### Set 28: coagulopathy · aki/ckd · renal (9 Qs)
- Primary: 6, Mimic: 3
- Scene 1 "coagulopathy / renal" — 4 Qs
- Scene 2 "copd/asthma / renal" — 3 Qs
- Scene 3 "thyroid / renal" — 2 Qs

### Set 29: anemia · coagulopathy · heme (7 Qs)
- Primary: 6, Mimic: 1
- Scene 1 "heme" — 3 Qs
- Scene 2 "anemia / coagulopathy / heme" — 2 Qs
- Scene 3 "heme" — 2 Qs

### Set 30: fever · cholecystitis · appendicitis (20 Qs)
- Primary: 10, Mimic: 10
- Scene 1 "fever / fatigue / cholecystitis / appendicitis" — 8 Qs
- Scene 2 "fever / weight loss / ra/ctd / pneumonia" — 5 Qs
- Scene 3 "fever / rash / pancreatitis" — 3 Qs
- Scene 4 "fever / mi/acs" — 2 Qs
- Scene 5 "fever / trauma" — 2 Qs

### Set 31: fever · copd/asthma · pneumonia (19 Qs)
- Primary: 8, Mimic: 11
- Scene 1 "fever / trauma / pneumonia" — 8 Qs
- Scene 2 "fever / urinary" — 5 Qs
- Scene 3 "fever / cough / copd/asthma" — 4 Qs
- Scene 4 "fever / nausea-vomiting / substance" — 2 Qs

### Set 32: dyspnea · copd/asthma · anemia · heme (25 Qs)
- Primary: 8, Mimic: 17
- Scene 1 "dyspnea / abd pain / anemia / heme" — 7 Qs
- Scene 2 "dyspnea / abd pain / hf / heme" — 7 Qs
- Scene 3 "dyspnea / edema / copd/asthma / mi/acs / heme" — 7 Qs
- Scene 4 "dyspnea / fever / pneumonia / hf / heme" — 4 Qs

### Set 33: abd pain · mi/acs · copd/asthma · heme (25 Qs)
- Primary: 8, Mimic: 17
- Scene 1 "abd pain / heme" — 7 Qs
- Scene 2 "abd pain / confusion / mi/acs / copd/asthma / heme" — 7 Qs
- Scene 3 "abd pain / fever / cholecystitis / uti/pyelonephritis / heme" — 7 Qs
- Scene 4 "abd pain / nausea-vomiting / heme" — 4 Qs

### Set 34: thyroid · depression · cardio (10 Qs)
- Primary: 8, Mimic: 2
- Scene 1 "coagulopathy / cardio" — 3 Qs
- Scene 2 "cardio" — 3 Qs
- Scene 3 "thyroid / cardio" — 2 Qs
- Scene 4 "cardio" — 2 Qs

### Set 35: psychosis/schizo · depression · psych (9 Qs)
- Primary: 6, Mimic: 3
- Scene 1 "coagulopathy / psych" — 5 Qs
- Scene 2 "depression / anxiety / psych" — 2 Qs
- Scene 3 "ra/ctd / psych" — 2 Qs

### Set 36: coagulopathy · preeclampsia/eclampsia · obgyn (6 Qs)
- Primary: 4, Mimic: 2
- Scene 1 "coagulopathy / obgyn" — 3 Qs
- Scene 2 "preeclampsia/eclampsia / obgyn" — 3 Qs

### Set 37: dyspnea · ra/ctd · hf (19 Qs)
- Primary: 6, Mimic: 13
- Scene 1 "dyspnea / cough / ra/ctd / hf" — 8 Qs
- Scene 2 "dyspnea / fatigue / pe/dvt / pneumonia" — 8 Qs
- Scene 3 "dyspnea / palpitations / anxiety / dka/hhs" — 3 Qs

### Set 38: fatigue · coagulopathy · depression · heme (25 Qs)
- Primary: 8, Mimic: 17
- Scene 1 "fatigue / coagulopathy / depression / heme" — 7 Qs
- Scene 2 "fatigue / heme" — 7 Qs
- Scene 3 "fatigue / bleeding / anemia / thyroid / heme" — 7 Qs
- Scene 4 "fatigue / weight loss / mi/acs / heme" — 4 Qs

### Set 39: fatigue · pancreatitis · anemia · heme (25 Qs)
- Primary: 8, Mimic: 17
- Scene 1 "fatigue / pancreatitis / heme" — 7 Qs
- Scene 2 "fatigue / anemia / coagulopathy / heme" — 7 Qs
- Scene 3 "fatigue / confusion / heme" — 7 Qs
- Scene 4 "fatigue / rash / heme" — 4 Qs

### Set 40: dyspnea · thyroid · mi/acs · cardio (25 Qs)
- Primary: 8, Mimic: 17
- Scene 1 "dyspnea / pe/dvt / hf / cardio" — 7 Qs
- Scene 2 "dyspnea / confusion / pe/dvt / anemia / cardio" — 7 Qs
- Scene 3 "dyspnea / edema / hf / mi/acs / cardio" — 7 Qs
- Scene 4 "dyspnea / fever / anxiety / cardio" — 4 Qs

### Set 41: mi/acs · coagulopathy · endo (6 Qs)
- Primary: 4, Mimic: 2
- Scene 1 "coagulopathy / endo" — 4 Qs
- Scene 2 "mi/acs / stroke / endo" — 2 Qs

### Set 42: edema · pe/dvt · mi/acs (25 Qs)
- Primary: 8, Mimic: 17
- Scene 1 "edema" — 7 Qs
- Scene 2 "edema / pe/dvt / mi/acs" — 7 Qs
- Scene 3 "edema / mi/acs / ra/ctd" — 7 Qs
- Scene 4 "edema / trauma" — 4 Qs

### Set 43: abd pain · cholecystitis · uti/pyelonephritis (25 Qs)
- Primary: 8, Mimic: 17
- Scene 1 "abd pain / bleeding / cholecystitis / uti/pyelonephritis" — 7 Qs
- Scene 2 "abd pain / edema / ra/ctd / preeclampsia/eclampsia" — 7 Qs
- Scene 3 "abd pain / fever / coagulopathy / pancreatitis" — 7 Qs
- Scene 4 "abd pain / nausea-vomiting" — 4 Qs

### Set 44: fatigue · depression · mi/acs (22 Qs)
- Primary: 8, Mimic: 14
- Scene 1 "fatigue / edema / anemia / coagulopathy" — 8 Qs
- Scene 2 "fatigue / edema / depression / substance" — 8 Qs
- Scene 3 "fatigue / weight loss / coagulopathy" — 4 Qs
- Scene 4 "fatigue / edema / mi/acs" — 2 Qs

### Set 45: fatigue · anemia · coagulopathy · neuro (24 Qs)
- Primary: 6, Mimic: 18
- Scene 1 "fatigue / anemia / neuro" — 8 Qs
- Scene 2 "fatigue / bleeding / coagulopathy / anemia / neuro" — 8 Qs
- Scene 3 "fatigue / bleeding / neuro" — 8 Qs

### Set 46: palpitations · ra/ctd · coagulopathy · heme (21 Qs)
- Primary: 10, Mimic: 11
- Scene 1 "rash / trauma / coagulopathy / heme" — 8 Qs
- Scene 2 "back pain / trauma / thyroid / heme" — 4 Qs
- Scene 3 "palpitations / heme" — 3 Qs
- Scene 4 "fever / confusion / uti/pyelonephritis / heme" — 3 Qs
- Scene 5 "urinary / heme" — 3 Qs

### Set 47: chest pain · anxiety · ra/ctd · cardio (23 Qs)
- Primary: 6, Mimic: 17
- Scene 1 "chest pain / dyspnea / anxiety / mi/acs / cardio" — 8 Qs
- Scene 2 "chest pain / dyspnea / mi/acs / thyroid / cardio" — 8 Qs
- Scene 3 "chest pain / dyspnea / cardio" — 7 Qs

### Set 48: fatigue · hf · anemia · renal (23 Qs)
- Primary: 6, Mimic: 17
- Scene 1 "fatigue / hf / renal" — 8 Qs
- Scene 2 "fatigue / back pain / coagulopathy / depression / renal" — 8 Qs
- Scene 3 "fatigue / edema / coagulopathy / renal" — 7 Qs

### Set 49: rash · pneumonia · mi/acs (19 Qs)
- Primary: 6, Mimic: 13
- Scene 1 "rash / pe/dvt / coagulopathy" — 8 Qs
- Scene 2 "rash / edema / pneumonia" — 6 Qs
- Scene 3 "rash / weight loss / mi/acs" — 5 Qs

### Set 50: headache · meningitis/encephalitis · pneumonia · neuro (23 Qs)
- Primary: 6, Mimic: 17
- Scene 1 "headache / meningitis/encephalitis / neuro" — 8 Qs
- Scene 2 "headache / confusion / meningitis/encephalitis / neuro" — 8 Qs
- Scene 3 "headache / fever / meningitis/encephalitis / pneumonia / neuro" — 7 Qs

## All Sets
- Set 21: trauma · copd/asthma · uti/pyelonephritis (26 Qs)
- Set 22: coagulopathy · depression · heme (6 Qs)
- Set 23: coagulopathy · substance (6 Qs)
- Set 24: fever · anemia · uti/pyelonephritis · heme (25 Qs)
- Set 25: ra/ctd · coagulopathy · neuro (8 Qs)
- Set 26: headache · pe/dvt · coagulopathy (20 Qs)
- Set 27: coagulopathy · stroke · renal (8 Qs)
- Set 28: coagulopathy · aki/ckd · renal (9 Qs)
- Set 29: anemia · coagulopathy · heme (7 Qs)
- Set 30: fever · cholecystitis · appendicitis (20 Qs)
- Set 31: fever · copd/asthma · pneumonia (19 Qs)
- Set 32: dyspnea · copd/asthma · anemia · heme (25 Qs)
- Set 33: abd pain · mi/acs · copd/asthma · heme (25 Qs)
- Set 34: thyroid · depression · cardio (10 Qs)
- Set 35: psychosis/schizo · depression · psych (9 Qs)
- Set 36: coagulopathy · preeclampsia/eclampsia · obgyn (6 Qs)
- Set 37: dyspnea · ra/ctd · hf (19 Qs)
- Set 38: fatigue · coagulopathy · depression · heme (25 Qs)
- Set 39: fatigue · pancreatitis · anemia · heme (25 Qs)
- Set 40: dyspnea · thyroid · mi/acs · cardio (25 Qs)
- Set 41: mi/acs · coagulopathy · endo (6 Qs)
- Set 42: edema · pe/dvt · mi/acs (25 Qs)
- Set 43: abd pain · cholecystitis · uti/pyelonephritis (25 Qs)
- Set 44: fatigue · depression · mi/acs (22 Qs)
- Set 45: fatigue · anemia · coagulopathy · neuro (24 Qs)
- Set 46: palpitations · ra/ctd · coagulopathy · heme (21 Qs)
- Set 47: chest pain · anxiety · ra/ctd · cardio (23 Qs)
- Set 48: fatigue · hf · anemia · renal (23 Qs)
- Set 49: rash · pneumonia · mi/acs (19 Qs)
- Set 50: headache · meningitis/encephalitis · pneumonia · neuro (23 Qs)
- Set 51: bleeding · mi/acs · ra/ctd · renal (17 Qs)
- Set 52: bleeding · anemia · coagulopathy · heme (22 Qs)
- Set 53: chest pain · pe/dvt · pneumonia (22 Qs)
- Set 54: fever · mi/acs · ra/ctd · neuro (20 Qs)
- Set 55: abd pain · cholecystitis · uti/pyelonephritis · heme (19 Qs)
- Set 56: dyspnea · pe/dvt · pneumonia (17 Qs)
- Set 57: headache · heme (19 Qs)
- Set 58: trauma · thyroid · substance · endo (13 Qs)
- Set 59: pneumonia · coagulopathy · neuro (9 Qs)
- Set 60: weight loss · mi/acs · pancreatitis (14 Qs)
- Set 61: dyspnea · pneumonia · coagulopathy · neuro (18 Qs)
- Set 62: abd pain · substance · cholecystitis · neuro (17 Qs)
- Set 63: seizure · preeclampsia/eclampsia · coagulopathy · neuro (15 Qs)
- Set 64: nausea-vomiting · preeclampsia/eclampsia · cholecystitis · h (16 Qs)
- Set 65: nausea-vomiting · pe/dvt · copd/asthma · cardio (13 Qs)
- Set 66: bleeding · heme (15 Qs)
- Set 67: nausea-vomiting · coagulopathy · appendicitis (15 Qs)
- Set 68: coagulopathy · mi/acs · cardio (8 Qs)
- Set 69: edema · pneumonia · coagulopathy · neuro (13 Qs)
- Set 70: palpitations · substance · copd/asthma (11 Qs)
- Set 71: fever · preeclampsia/eclampsia (14 Qs)
- Set 72: headache · mi/acs · stroke (14 Qs)
- Set 73: trauma · mi/acs · ra/ctd (14 Qs)
- Set 74: back pain · anemia · substance · heme (10 Qs)
- Set 75: back pain · renal (13 Qs)
- Set 76: edema · coagulopathy · hf · heme (13 Qs)
- Set 77: abd pain · pneumonia · cholecystitis · gi (13 Qs)
- Set 78: cough · copd/asthma · hf (11 Qs)
- Set 79: bleeding · coagulopathy · substance (12 Qs)
- Set 80: rash · heme (12 Qs)
- Set 81: edema · gi (12 Qs)
- Set 82: edema · pe/dvt · hf · heme (12 Qs)
- Set 83: abd pain · pe/dvt · aki/ckd (12 Qs)
- Set 84: nausea-vomiting · thyroid · renal (12 Qs)
- Set 85: nausea-vomiting · cardio (11 Qs)
- Set 86: fatigue · depression · anxiety · heme (11 Qs)
- Set 87: sepsis · anemia · heme (11 Qs)
- Set 88: bleeding · gi (11 Qs)
- Set 89: trauma · heme (11 Qs)
- Set 90: chest pain · mi/acs · pe/dvt · heme (11 Qs)
- Set 91: chest pain · neuro (11 Qs)
- Set 92: edema (10 Qs)
- Set 93: weight loss · coagulopathy · thyroid · heme (11 Qs)
- Set 94: fever · pneumonia (11 Qs)
- Set 95: abd pain · uti/pyelonephritis · ra/ctd · renal (11 Qs)
- Set 96: fatigue · coagulopathy · anemia (10 Qs)
- Set 97: trauma · pneumonia · ra/ctd · resp (9 Qs)
- Set 98: fatigue · psychosis/schizo · depression · heme (10 Qs)
- Set 99: chest pain · hf · cirrhosis/liver (10 Qs)
- Set 100: dyspnea · sepsis · anemia · heme (10 Qs)
- Set 101: headache · coagulopathy · psych (10 Qs)
- Set 102: nausea-vomiting · pancreatitis · depression · neuro (10 Qs)
- Set 103: rash · copd/asthma · coagulopathy · neuro (9 Qs)
- Set 104: headache · cirrhosis/liver · anemia · renal (9 Qs)
- Set 105: fever · hf · coagulopathy · neuro (9 Qs)
- Set 106: edema · uti/pyelonephritis · copd/asthma · heme (9 Qs)
- Set 107: renal (9 Qs)
- Set 108: fever · ra/ctd · heme (9 Qs)
- Set 109: chest pain · thyroid · cardio (9 Qs)
- Set 110: trauma · neuro (9 Qs)
- Set 111: abd pain · pneumonia · heme (9 Qs)
- Set 112: fever · cirrhosis/liver · mi/acs · heme (9 Qs)
- Set 113: anxiety · psychosis/schizo · psych (9 Qs)
- Set 114: dyspnea · aki/ckd · mi/acs · renal (9 Qs)
- Set 115: fever · mi/acs · ra/ctd · renal (9 Qs)
- Set 116: confusion · gi (6 Qs)
- Set 117: back pain · substance · mi/acs · neuro (8 Qs)
- Set 118: headache · siadh/di · neuro (8 Qs)
- Set 119: fever · coagulopathy · heme (8 Qs)
- Set 120: fever · mi/acs · coagulopathy · heme (8 Qs)
- Set 121: depression · substance (8 Qs)
- Set 122: headache (8 Qs)
- Set 123: anxiety · coagulopathy · heme (8 Qs)
- Set 124: edema · neuro (8 Qs)
- Set 125: coagulopathy · psychosis/schizo (8 Qs)
- Set 126: nausea-vomiting (8 Qs)
- Set 127: dyspnea · mi/acs · ra/ctd · resp (8 Qs)
- Set 128: dyspnea · cardio (8 Qs)
- Set 129: cough · coagulopathy · heme (8 Qs)
- Set 130: dyspnea · pe/dvt · pneumonia · resp (8 Qs)
- Set 131: fatigue · mi/acs · depression · cardio (8 Qs)
- Set 132: joint pain · pancreatitis · anemia (8 Qs)
- Set 133: back pain · coagulopathy (8 Qs)
- Set 134: fatigue · obgyn (7 Qs)
- Set 135: fever · renal (6 Qs)
- Set 136: fatigue · thyroid · anemia · heme (6 Qs)
- Set 137: hf · thyroid · renal (6 Qs)

## Unclustered Pool: 2185 questions

These questions could not cluster into project-based sets of ≥ 6 questions. Most are genuine "standalone"
test items without plausible clinical-scenario neighbors.
They remain in the pool for manual review or assignment into existing sets where a reviewer
identifies a missed scenario connection.
