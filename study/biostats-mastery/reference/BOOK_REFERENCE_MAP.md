# Biostats Question Bank → Reference Book Map

Two books in `reference/reference-books/`:

| Book | Best for |
|------|----------|
| **Understandable Statistics** (Brase & Brase, 13th Ed) | Core stats: distributions, CIs, hypothesis testing, t-tests, chi-square, ANOVA, correlation, regression |
| **High-Yield Biostatistics** (Glaser, 4th Ed) | Medical stats: OR, RR, NNT, forest/funnel plots, meta-analysis, non-inferiority, validity, bias, screening (Sn/Sp/PPV/NPV), epidemiology |

---

## Q1–Q11: Drug Ads & HR/Cumulative Curves (CardioShield, NovaStat, Defend-1/2)
**Concepts:** Hazard ratio, survival curves, cumulative incidence, ARR  
**High-Yield:** Ch 5 (testing differences), Ch 8 (risk measurement, NNT, attributable risk)  
**Printable graphs:** Figure 6-3 (forest plot), survival curves in Ch 5

## Q12–Q15, Q18–Q19: Effect Size, Power, Sample Size (MetaBoost, InferMigraine)
**Concepts:** Cohen's d, SE, t-test, n-slider, power curve  
**Understandable Stats:** Ch 6 (normal dist, CLT), Ch 7 (CIs), Ch 8 (hypothesis testing, t-test, paired differences)  
**Printable graphs:** t-distribution tables (Formula Card), normal curve figures, power curves

## Q13: Multiple Comparisons / Subgroup Analysis (NovaStat — forest plot)
**Concepts:** FWER, multiplicity, Bonferroni, subgroup analysis  
**High-Yield:** Ch 6 (meta-analysis, forest plots, funnel plots), Ch 5 (multiple comparisons)  
**Printable graphs:** Figure 6-3 (forest plot), Figure 6-1 (symmetrical funnel), Figure 6-2 (asymmetrical funnel)

## Q16: CI Width & Sample Size (Defend-1 vs Defend-2)
**Concepts:** Same point estimate, different precision, SE ∝ 1/√n  
**Understandable Stats:** Ch 7 (CI estimation, width depends on n), Ch 8 (SE and precision)  
**High-Yield:** Ch 6 (forest plot interpretation)  
**Printable graphs:** Figure 6-3 (comparative forest plot)

## Q17: Paired t-test / Spaghetti Plot (crossover trial)
**Concepts:** Within-subject variance, paired vs independent SE  
**Understandable Stats:** Ch 8.4 (paired differences, dependent samples) — this is the exact chapter  
**Printable graphs:** Paired difference diagram, t-distribution critical values table

## Q20: Carryover Effect (crossover trial bias)
**Concepts:** Crossover design, washout period, carryover contamination  
**High-Yield:** Ch 4 (crossover studies, repeated measures), Ch 5 (bias types)  
**Printable graphs:** Crossover design schematic (two-period, two-sequence diagram)

## Q21–Q24: Non-Inferiority Trials (HeartGuard)
**Concepts:** NI margin, hierarchical testing, NNT/NNH, CI vs margin  
**High-Yield:** Ch 5 (noninferiority trials section), Ch 8 (NNT, risk measurement)  
**Understandable Stats:** Ch 8 (hypothesis test logic reversal — NI flips H₀)  
**Printable graphs:** Forest plot with margin line, two-reference-line diagram

## Q25: Test Selection (chi-square vs t-test for binary outcome)
**Concepts:** Binary outcome → chi-square, continuous → t-test, time-to-event → log-rank  
**Understandable Stats:** Ch 10.1 (chi-square tests of independence), Ch 8.2 (t-test with means)  
**High-Yield:** Ch 2 (choosing statistical tests — test selection flowchart)  
**Printable graphs:** Contingency table 2×2, test selection decision tree (High-Yield Ch 2)

## Q26: I² = 0% (meta-analysis — no heterogeneity)
**Concepts:** I² statistic, fixed vs random effects, Cochran's Q, homogeneity  
**High-Yield:** Ch 6 (systematic reviews, meta-analysis, I² interpretation)  
**Printable graphs:** Forest plot with tight CI overlap (all rows similar), fixed-effect diamond

## Q27: Funnel Plot Asymmetry (publication bias)
**Concepts:** Funnel plot, publication bias, small-study effects  
**High-Yield:** Ch 6 (funnel plots, Figures 6-1 and 6-2) — exact match  
**Printable graphs:** Symmetrical funnel (Figure 6-1: no bias), asymmetrical funnel (Figure 6-2: small negative studies missing)

## Q28: External Validity (narrow enrollment)
**Concepts:** Internal vs external validity, generalizability, inclusion criteria  
**High-Yield:** Ch 3 (validity, reliability), Ch 4 (sampling, generalizability) — exact match  
**Printable graphs:** Validity hierarchy diagram, sampling frame diagram

## Q29: FWER / Multiple Endpoints (3 endpoints at α=0.05)
**Concepts:** Familywise error rate, Bonferroni correction, multiplicity  
**High-Yield:** Ch 5 (multiple comparisons), Ch 6 (meta-analysis multiple outcomes)  
**Understandable Stats:** Ch 10.5 (ANOVA — multiple group comparison, post-hoc correction)  
**Printable graphs:** Forest plot with FWER annotation, Bonferroni table

## Q30: t-test with Small n, Skewed Data (n=18, LDL)
**Concepts:** t-test assumptions (normality, sample size, CLT at n≈30)  
**Understandable Stats:** Ch 8.2 (testing μ), Ch 8.4 (t-test assumptions)  
**Printable graphs:** t-distribution vs normal overlay, sample size vs normality table

## Q34: Case-Control Study / OR vs RR (CognEase — the mountain & pit metaphor)
**Concepts:** OR, RR, case-control design, rare disease assumption  
**High-Yield:** Ch 8 (odds ratio, case-control vs cohort), Ch 4 (study designs)  
**Printable graphs:** 2×2 table (OR/RR calculation), study design comparison chart  
**Our schematic:** The mountain & pit metaphor (built as SVG in the app)

## Q35–Q179: Study Designs, Bias, Contingency Tables, PPV/ROC, etc.
**High-Yield:** Covers all remaining concepts across Ch 2 (test selection), Ch 3 (validity), Ch 4 (study designs), Ch 5 (bias types), Ch 8 (risk, OR, RR, NNT), Ch 9 (epidemiology)  
**Understandable Stats:** Ch 9 (correlation/regression), Ch 10 (chi-square, ANOVA), Ch 11 (nonparametric tests)

---

## Quick Agent Workflow

When fixing/authoring a question:

1. **Check the question's graph type and concept** (from `stats_questions.json`)
2. **Look up in this table** which book covers the concept
3. **Extract the relevant pages** from the PDF:
   ```powershell
   node -e "const fs=require('fs');const pdf=require('pdf-parse');pdf(fs.readFileSync('reference/reference-books/High-yield-Glaser-...pdf')).then(d=>{const t=d.text;const i=t.indexOf('YOUR TERM');i>=0?console.log(t.substring(i-100,i+800)):console.log('not found')})"
   ```
4. **Paraphrase in Immersa attending voice** — never paste verbatim
5. **Cite the book page** in the question's `book_ref` field

## Key Figures to Extract for Each Graph Type

| Graph Type | Book | Figure Reference |
|---|---|---|
| `cumulative` (survival curves) | High-Yield Ch 5 | Survival curve with censoring marks |
| `normal` (effect size, power) | Understandable Ch 6-8 | Normal distribution, t-distribution, power curve |
| `bar` (proportions, ARR) | Understandable Ch 2 | Bar chart, histogram |
| `forestPlot` | High-Yield Ch 6 | Figure 6-3: forest plot (statins & arrhythmia) |
| `funnelPlot` | High-Yield Ch 6 | Figures 6-1, 6-2: symmetrical & asymmetrical funnels |
| `biasDiagram` | High-Yield Ch 5 | Bias type schematics |
| `studyDesignGrid` | High-Yield Ch 4 | Study design comparison (case-control, cohort, RCT, cross-sectional) |
| `contingencyTable` | High-Yield Ch 8 | 2×2 table for OR/RR calculation |
| `ppvCurve` | High-Yield Ch 3 | ROC curve, sensitivity/specificity framework |
| `rocCurve` | High-Yield Ch 3 | ROC curve with AUC annotation |
| `spaghettiPlot` (paired test) | Understandable Ch 8.4 | Paired differences diagram |
| `phaseTimeline` | High-Yield Ch 4 | Clinical trial phases (I–IV) timeline |
| `dag` | High-Yield Ch 5 | Directed acyclic graph (confounding) |
| `decisionTree` | High-Yield Ch 2 | Test selection decision tree |
