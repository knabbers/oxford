// Lecture content for Dr Earl's Prelims Analysis I lectures (owned by places/maths.js). Pure data.
// Follows the official M2 Analysis I synopsis (reals as a complete ordered field, sup/inf, limits, algebra of limits,
// monotone sequences, subsequences, Bolzano–Weierstrass, Cauchy sequences, series). Board layouts and wording are
// invented for the game. Markup: see _maths_chalk.js. Each frame = one board-full; `say` = what he says while writing.
// ℕ = {1, 2, 3, …} throughout.

export const LECTURES = [
  {
    title: 'Analysis I — Lecture 1: The real numbers',
    topic: 'the Completeness Axiom',
    frames: [
      { say: "Good morning. Let's begin with the real numbers, which you've been using for years without being told what they are.",
        lines: ['# Analysis I: Sequences and Series', 'Lecture 1.  The real numbers', 'ℝ is a field: + and × satisfy the usual laws', '(associative, commutative, distributive,', ' 0 and 1, negatives, inverses of x ≠ 0).', 'ℝ is also ordered, and the order is', 'compatible with + and ×, as follows.'] },
      { say: 'Four order axioms. Nothing surprising here, and that is rather the point.',
        lines: ['# Order axioms  (for all a, b, c ∈ ℝ)', '(O1)  exactly one of a < b, a = b, b < a', '(O2)  a < b and b < c  ⇒  a < c', '(O3)  a < b  ⇒  a + c < b + c', '(O4)  a < b and 0 < c  ⇒  ac < bc', 'But ℚ satisfies all of these too. What', 'makes ℝ different?   Completeness.'] },
      { say: 'Upper bounds first. A set may have many of them, or none at all.',
        lines: ['# Bounds', 'Let S ⊆ ℝ. M ∈ ℝ is an upper bound for S if', '     s ≤ M  for all s ∈ S.', 'S is bounded above if it has an upper bound.', 'Def.  α is a supremum (least upper bound)', 'of S if  (i) α is an upper bound for S, and', '(ii) α ≤ M for every upper bound M of S.'] },
      { say: "Two suprema would each be at most the other, so there's only ever one. Notice it needn't belong to the set.",
        lines: ['A set has at most one supremum: if α and β', 'are both suprema then α ≤ β (as β is an upper', 'bound) and β ≤ α, so α = β. We write sup S.', 'The sup need not lie in S:', '   sup (0, 1) = 1 ∉ (0, 1),    sup [0, 1] = 1.', 'If sup S ∈ S we call it the maximum, max S.'] },
      { say: 'This is the axiom. Everything else in the course leans on it, so do learn it word for word.',
        lines: ['* The Completeness Axiom', '* Every non-empty subset of ℝ which is', '* bounded above has a supremum in ℝ.', 'Both hypotheses matter:', ' ∅ has no sup (every real bounds it above),', ' and ℕ is not bounded above, as we', ' shall prove shortly.'] },
      { say: 'Infima come for free, by turning everything upside down.',
        lines: ['# Infima', 'm is a lower bound for S if m ≤ s ∀ s ∈ S;', 'inf S is the greatest lower bound.', 'Prop.  If S ≠ ∅ is bounded below then', 'inf S exists, and  inf S = −sup(−S),', 'where −S = {−s : s ∈ S}.'] },
      { say: "The proof is just a matter of keeping track of minus signs. Do check each one — I've been known to drop them.",
        lines: ['Proof.  m is a lower bound for S  ⟺  −m is', 'an upper bound for −S. So −S is non-empty', 'and bounded above; let α = sup(−S).', 'Then −α is a lower bound for S, and if m', 'is any lower bound for S, then −m is an', 'upper bound for −S, so α ≤ −m, i.e. m ≤ −α.', 'So −α = inf S.   □'] },
      { say: "A useful little lemma: you can always find elements of S as close to the supremum as you like.",
        lines: ['# The approximation property', 'Let S ≠ ∅ have supremum α. Then for every', 'ε > 0 there is s ∈ S with  α − ε < s ≤ α.', 'Proof.  α − ε < α, so α − ε is not an upper', 'bound for S: some s ∈ S has s > α − ε.', 'And s ≤ α, as α is an upper bound.   □'] },
      { say: 'Now something that sounds obvious but genuinely needs completeness.',
        lines: ['* Theorem (Archimedean property)', '* ℕ is not bounded above in ℝ.', 'Proof.  Suppose it were. As ℕ ≠ ∅, by', 'completeness α = sup ℕ exists. By the', 'approximation property with ε = 1, there', 'is n ∈ ℕ with n > α − 1. Then n + 1 > α,'] },
      { say: "And there's the contradiction. The corollary is the form you'll use every week.",
        lines: ['but n + 1 ∈ ℕ, contradicting the fact that', 'α is an upper bound for ℕ.   □', 'Corollary.  For every ε > 0 there is n ∈ ℕ', 'with  [[1@n]] < ε.      (Take n > [[1@ε]].)'] },
      { say: 'Let us show the reals contain a square root of two. The rationals, famously, do not.',
        lines: ['# √2 exists in ℝ', 'Let S = {x ∈ ℝ : x > 0 and x^2 < 2}. Then 1 ∈ S,', 'and 2 is an upper bound for S, since', 'x ≥ 2 ⇒ x^2 ≥ 4. Let α = sup S, so 1 ≤ α ≤ 2.', 'Claim:  α^2 = 2.  We rule out α^2 < 2 and', 'α^2 > 2 in turn.'] },
      { say: 'If alpha squared were too small, we could nudge alpha up a little and stay inside S.',
        lines: ['Case α^2 < 2.  For 0 < h < 1,', '(α + h)^2 = α^2 + 2αh + h^2 < α^2 + 5h,', 'since 2α ≤ 4 and h^2 < h. Choose 0 < h < 1', 'with h ≤ [[2 − α^2@5]]. Then (α + h)^2 < 2, so', 'α + h ∈ S — but α + h > α = sup S.', 'Contradiction.'] },
      { say: 'If it were too big, we could nudge it down and still have an upper bound. Either way, a contradiction.',
        lines: ['Case α^2 > 2.  For 0 < h < α,', '(α − h)^2 = α^2 − 2αh + h^2 > α^2 − 4h.', 'Choose such h with h ≤ [[α^2 − 2@4]]; then (α − h)^2 > 2.', 'If x ∈ S had x > α − h > 0, then', 'x^2 > (α − h)^2 > 2, which is impossible. So', 'α − h is an upper bound less than α. Contradiction.'] },
      { say: "So the rationals are an ordered field with a hole where root two should be. Next time: sequences. Thank you.",
        lines: ['Hence α^2 = 2: √2 exists in ℝ.', 'But no rational q has q^2 = 2. So ℚ is an', 'ordered field which is not complete:', '{q ∈ ℚ : q > 0, q^2 < 2} has no sup in ℚ.', 'Next time: sequences, and what it means', 'to say  a_n → a.'] },
    ],
    quiz: [
      { q: 'What is sup{1 − 1/n : n ∈ ℕ}?', options: ['0', '1/2', '1', 'It does not exist'], answer: 2 },
      { q: 'Which of these subsets of ℝ has no supremum in ℝ?', options: ['(0, 1)', '{x ∈ ℚ : x² < 2}', '{−1/n : n ∈ ℕ}', 'ℕ'], answer: 3 },
      { q: 'The Archimedean property says…', options: ['for every x ∈ ℝ there is n ∈ ℕ with n > x', 'every bounded set has a maximum', 'every real number is a limit of rationals', 'ℕ has a supremum'], answer: 0 },
    ],
  },
  {
    title: 'Analysis I — Lecture 2: Sequences and limits',
    topic: 'ε–N convergence',
    frames: [
      { say: 'Today, the most important definition in the course. Please copy it exactly, quantifiers and all.',
        lines: ['# Lecture 2.  Sequences and limits', 'A real sequence is a function ℕ → ℝ, n ↦ a_n.', 'Def.  a_n → a as n → ∞  (a_n converges to a)', 'if for every ε > 0 there exists N ∈ ℕ', 'such that  |a_n − a| < ε  for all n ≥ N.', '   ∀ ε > 0  ∃ N ∈ ℕ  ∀ n ≥ N :  |a_n − a| < ε'] },
      { say: 'Think of it as a game: you choose epsilon, I must find an N. The order of the quantifiers is the whole content.',
        lines: ['The order of the quantifiers matters:', 'N may depend on ε (it usually does), but', 'it must work for every n ≥ N.', 'Picture: from the N-th term onwards, all', 'terms lie in the strip (a − ε, a + ε).', 'A sequence which converges to no a is said', 'to diverge.'] },
      { say: 'Our first example uses last time’s corollary of the Archimedean property.',
        lines: ['# Example:  1/n → 0', 'Let ε > 0. By the Archimedean property', 'there is N ∈ ℕ with N > [[1@ε]]. Then for n ≥ N,', '    |[[1@n]] − 0| = [[1@n]] ≤ [[1@N]] < ε.     □', 'N depends on ε:  ε = 0.01 needs N > 100.'] },
      { say: 'To show something diverges, assume it converges and find an epsilon that defeats every N.',
        lines: ['# Example:  ((−1)^n) diverges', 'Suppose (−1)^n → a. Take ε = 1: there is N', 'with |(−1)^n − a| < 1 for all n ≥ N. Then', '2 = |(−1)^N − (−1)^{N+1}|', '  ≤ |(−1)^N − a| + |a − (−1)^{N+1}| < 1 + 1 = 2.', 'Contradiction.   □'] },
      { say: 'Limits are unique, which is reassuring — otherwise the notation would be a lie.',
        lines: ['* Theorem.  Limits are unique:', '* if a_n → a and a_n → b, then a = b.', 'Proof.  Suppose a ≠ b; let ε = [[|a − b|@2]] > 0.', 'There are N_1, N_2 ∈ ℕ with', '   |a_n − a| < ε  for all n ≥ N_1, and', '   |a_n − b| < ε  for all n ≥ N_2.'] },
      { say: 'Take n large enough for both, and the triangle inequality does the rest.',
        lines: ['Let n = max(N_1, N_2). Then', '|a − b| ≤ |a − a_n| + |a_n − b| < 2ε = |a − b|,', 'a contradiction.   □'] },
      { say: 'Convergent sequences are bounded. Finitely many terms can misbehave, but only finitely many.',
        lines: ['* Theorem.  Convergent ⇒ bounded.', 'Proof.  Let a_n → a. With ε = 1 there is N', 'such that |a_n − a| < 1, so |a_n| < |a| + 1,', 'for all n ≥ N. So |a_n| ≤ M for all n, where', '   M = max(|a_1|, …, |a_{N−1}|, |a| + 1).   □', 'The converse fails: ((−1)^n) is bounded.'] },
      { say: 'The algebra of limits: these let us avoid epsilons most of the time. But first we must earn them.',
        lines: ['# Algebra of limits', 'Suppose a_n → a and b_n → b. Then', '(i)  a_n + b_n → a + b,    (ii)  a_n b_n → ab,', '(iii)  λa_n → λa  for each λ ∈ ℝ,', '(iv)  if b ≠ 0, then b_n ≠ 0 for all large n,', 'and  [[a_n@b_n]] → [[a@b]]  (taken over those n).'] },
      { say: 'For the sum we share epsilon between the two terms: half each.',
        lines: ['Proof of (i).  Let ε > 0. Choose N_1, N_2 with', '|a_n − a| < [[ε@2]] for n ≥ N_1, |b_n − b| < [[ε@2]] for n ≥ N_2.', 'Then for all n ≥ max(N_1, N_2),', '|(a_n + b_n) − (a + b)|', '    ≤ |a_n − a| + |b_n − b| < [[ε@2]] + [[ε@2]] = ε.   □'] },
      { say: 'The product needs a small trick: add and subtract a times b_n, and use that convergent sequences are bounded.',
        lines: ['Proof of (ii).  (b_n) is convergent, so', 'bounded: |b_n| ≤ M for all n, for some M > 0.', '|a_n b_n − ab| = |(a_n − a)b_n + a(b_n − b)|', '     ≤ M|a_n − a| + |a| |b_n − b|.', 'Given ε > 0, for all large n we have', '|a_n − a| < [[ε@2M]]  and  |b_n − b| < [[ε@2(|a| + 1)]].'] },
      { say: "And now the payoff: limits of rational functions without a single epsilon.",
        lines: ['So  |a_n b_n − ab| < [[ε@2]] + [[|a|ε@2(|a| + 1)]] < ε.   □', '# Example', 'a_n = [[3n^2 + n@n^2 + 5]] = [[3 + 1/n@1 + 5/n^2]] → [[3 + 0@1 + 0]] = 3,', 'using 1/n → 0 and (i)–(iv).'] },
      { say: 'One last tool: squeeze a sequence between two that agree, and it has no choice.',
        lines: ['* Sandwich lemma.  If a_n ≤ b_n ≤ c_n for all n,', '* and a_n → ℓ, c_n → ℓ, then b_n → ℓ.', 'Proof.  Given ε > 0, for all large n,', '   ℓ − ε < a_n ≤ b_n ≤ c_n < ℓ + ε.   □', 'e.g.  −[[1@n]] ≤ [[(−1)^n@n]] ≤ [[1@n]],  so  [[(−1)^n@n]] → 0.'] },
    ],
    quiz: [
      { q: 'Which statement is the definition of aₙ → a?', options: ['∀ε>0 ∃N ∀n≥N : |aₙ − a| < ε', '∃N ∀ε>0 ∀n≥N : |aₙ − a| < ε', '∀ε>0 ∀N ∃n≥N : |aₙ − a| < ε', '∃ε>0 ∃N ∀n≥N : |aₙ − a| < ε'], answer: 0 },
      { q: 'Which of these sequences converges?', options: ['(−1)ⁿ', 'n/(n + 1)', 'n²/(n + 1)', '(−1)ⁿ n'], answer: 1 },
      { q: 'If aₙ → 2 and bₙ → 3, then (aₙbₙ + 1)/bₙ → ?', options: ['2', '7/3', '7/2', '3'], answer: 1 },
    ],
  },
  {
    title: 'Analysis I — Lecture 3: Monotone sequences and Bolzano–Weierstrass',
    topic: 'Bolzano–Weierstrass',
    frames: [
      { say: 'Monotone sequences today. Completeness will turn out to be exactly what makes them converge.',
        lines: ['# Lecture 3.  Monotone sequences', '(a_n) is increasing if a_n ≤ a_{n+1} for all n,', 'decreasing if a_n ≥ a_{n+1} for all n,', 'and monotone if it is either.', '* Theorem (Monotone Convergence).', '* An increasing sequence which is bounded', '* above converges, to sup{a_n : n ∈ ℕ}.'] },
      { say: "Here the approximation property earns its keep.",
        lines: ['Proof.  S = {a_n : n ∈ ℕ} is non-empty and', 'bounded above; let α = sup S (completeness).', 'Let ε > 0. By the approximation property', 'there is N with a_N > α − ε. For all n ≥ N,', '    α − ε < a_N ≤ a_n ≤ α < α + ε,', 'so |a_n − α| < ε.   □'] },
      { say: "An old friend: this is the Babylonian method for square roots, and it converges remarkably fast.",
        lines: ['Similarly, a decreasing sequence which is', 'bounded below converges, to its infimum.', '# Example', 'x_1 = 2,    x_{n+1} = [[1@2]](x_n + [[2@x_n]]).', 'By induction x_n > 0 and x_n ∈ ℚ, and', 'x_{n+1}^2 − 2 = [[1@4]](x_n − [[2@x_n]])^2 ≥ 0.'] },
      { say: 'Decreasing and bounded below, so it converges; the algebra of limits tells us to what.',
        lines: ['So x_n^2 ≥ 2 for all n (x_1^2 = 4), hence x_n ≥ 1, and', 'x_n − x_{n+1} = [[x_n^2 − 2@2x_n]] ≥ 0 :  (x_n) is decreasing.', 'Bounded below by 1, so x_n → ℓ, with ℓ ≥ 1', '(limits preserve ≥). By the algebra of limits', 'ℓ = [[1@2]](ℓ + [[2@ℓ]]), so ℓ^2 = 2 :  x_n → √2.', 'x_2 = 1.5, x_3 = 1.41666..., x_5 = 1.41421356...'] },
      { say: 'Subsequences: keep infinitely many terms, in order, and throw the rest away.',
        lines: ['# Subsequences', 'If n_1 < n_2 < n_3 < ⋯ are natural numbers,', 'then (a_{n_k})_{k≥1} is a subsequence of (a_n).', 'Note n_k ≥ k for all k (induction).', 'Fact: if a_n → a, then every subsequence', 'a_{n_k} → a as k → ∞.'] },
      { say: 'Now a lovely lemma. Call a term a peak if nothing later is bigger: think of the view from a mountain.',
        lines: ['* Lemma.  Every real sequence has a', '* monotone subsequence.', 'Proof.  Call m a peak if a_m ≥ a_n for all n > m.', 'Case 1: there are infinitely many peaks,', 'm_1 < m_2 < m_3 < ⋯ . Then', 'a_{m_1} ≥ a_{m_2} ≥ a_{m_3} ≥ ⋯ is decreasing.'] },
      { say: 'If the peaks run out, every later term can see something higher, and we climb.',
        lines: ['Case 2: finitely many peaks. Choose n_1', 'beyond all of them. n_1 is not a peak, so', 'some n_2 > n_1 has a_{n_2} > a_{n_1}. n_2 is not a', 'peak either, so some n_3 > n_2 has a_{n_3} > a_{n_2};', 'and so on. This gives an increasing', 'subsequence.   □'] },
      { say: 'And the theorem drops out in two lines. It is one of the workhorses of analysis.',
        lines: ['* Theorem (Bolzano–Weierstrass).', '* Every bounded sequence of real numbers', '* has a convergent subsequence.', 'Proof.  By the Lemma, (a_n) has a monotone', 'subsequence. It is bounded, so it converges', 'by the Monotone Convergence Theorem.   □'] },
      { say: 'Note what the theorem does not tell you: which subsequence, or what its limit is.',
        lines: ['# Examples', 'a_n = (−1)^n :  a_{2k} → 1  and  a_{2k−1} → −1.', 'a_n = sin n (once sin is defined) is bounded,', 'so some subsequence converges, though it is', 'not easy to say which one!', 'Boundedness is needed:  a_n = n  has no', 'convergent subsequence.'] },
      { say: "In the rationals the theorem is simply false, which tells you where the work is being done.",
        lines: ['Remark.  B–W fails in ℚ. Our sequence (x_n)', 'is rational and bounded, but every', 'subsequence tends to √2 ∉ ℚ, so no', 'subsequence converges to a rational.', 'Completeness is doing the work.'] },
      { say: 'The same goes for complex numbers: take a subsequence, then a subsequence of that.',
        lines: ['Corollary.  Every bounded sequence (z_n) in ℂ', 'has a convergent subsequence.', 'Proof.  Write z_n = x_n + i y_n; both are bounded.', 'By B–W, x_{n_k} → x for some subsequence; then', '(y_{n_k}) is bounded, so y_{n_{k_j}} → y for some', 'sub-subsequence, along which x_{n_{k_j}} → x still.', 'So z_{n_{k_j}} → x + iy.   □'] },
      { say: "Next time, Cauchy sequences: a way to prove convergence without knowing the limit. Thank you.",
        lines: ['Next time:  Cauchy sequences —', 'a test for convergence that does not', 'need to know the limit in advance.'] },
    ],
    quiz: [
      { q: 'Bolzano–Weierstrass: every ______ real sequence has a convergent subsequence.', options: ['monotone', 'bounded', 'positive', 'divergent'], answer: 1 },
      { q: 'x₁ = 2 and xₙ₊₁ = ½(xₙ + 2/xₙ). What is x₂?', options: ['1', '4/3', '3/2', '2'], answer: 2 },
      { q: 'Which sequence has NO convergent subsequence?', options: ['(−1)ⁿ', '1/n', 'sin n', 'n'], answer: 3 },
    ],
  },
  {
    title: 'Analysis I — Lecture 4: Cauchy sequences and series',
    topic: 'Cauchy sequences',
    frames: [
      { say: 'Today: how to tell a sequence converges when you have no idea what its limit is.',
        lines: ['# Lecture 4.  Cauchy sequences', 'Def.  (a_n) is a Cauchy sequence if for every', 'ε > 0 there is N ∈ ℕ such that', '     |a_m − a_n| < ε   for all m, n ≥ N.', 'The terms get close to each other;', 'no limit is mentioned.'] },
      { say: 'One direction is easy, and you could probably have written it yourselves.',
        lines: ['* Prop.  Convergent ⇒ Cauchy.', 'Proof.  Let a_n → a and ε > 0. Take N with', '|a_n − a| < [[ε@2]] for all n ≥ N. Then for m, n ≥ N,', '|a_m − a_n| ≤ |a_m − a| + |a − a_n| < ε.   □'] },
      { say: 'Cauchy sequences are bounded, by the same argument as for convergent ones.',
        lines: ['* Prop.  Cauchy ⇒ bounded.', 'Proof.  With ε = 1 there is N such that', '|a_n − a_N| < 1 for all n ≥ N. So for all n,', '|a_n| ≤ max(|a_1|, …, |a_{N−1}|, |a_N| + 1).   □'] },
      { say: 'The converse is the real theorem, and it is where Bolzano–Weierstrass comes in.',
        lines: ['* Theorem (Cauchy criterion).  A real', '* sequence converges if and only if it', '* is Cauchy.', 'Proof.  (⇒) done.  (⇐) Let (a_n) be Cauchy.', 'It is bounded, so by Bolzano–Weierstrass', 'some subsequence a_{n_k} → a, say.'] },
      { say: 'A Cauchy sequence with a convergent subsequence is dragged along with it.',
        lines: ['Claim: a_n → a. Let ε > 0. Choose N with', '|a_m − a_n| < [[ε@2]] for all m, n ≥ N, and K with', '|a_{n_k} − a| < [[ε@2]] for all k ≥ K. Fix k ≥ max(K, N);', 'then n_k ≥ k ≥ N, so for every n ≥ N,', '|a_n − a| ≤ |a_n − a_{n_k}| + |a_{n_k} − a| < ε.   □'] },
      { say: 'Once again the rationals let us down — or rather, they show us what completeness buys.',
        lines: ['Again completeness is essential: in ℚ,', 'our rational sequence x_n → √2 is Cauchy', '(it converges in ℝ), but it has no limit in ℚ.'] },
      { say: 'Series are just sequences of partial sums, so everything we have done applies.',
        lines: ['# Series', 'Given (a_k), the partial sums are', '   s_n = a_1 + a_2 + ⋯ + a_n = ∑_{k=1}^{n} a_k.', '∑ a_k converges (to s) if s_n → s. Cauchy:', '∑ a_k converges  ⟺  ∀ ε > 0 ∃ N such that', '|a_{n+1} + ⋯ + a_m| < ε  for all m > n ≥ N.'] },
      { say: 'Here is a series whose terms tend to zero, and yet it diverges. A classic.',
        lines: ['# The harmonic series', 's_n = 1 + [[1@2]] + [[1@3]] + ⋯ + [[1@n]].  Then', 's_{2n} − s_n = [[1@n + 1]] + ⋯ + [[1@2n]] ≥ n · [[1@2n]] = [[1@2]].', 'So (s_n) is not Cauchy (take ε = [[1@2]]),', 'hence ∑ [[1@k]] diverges, even though [[1@k]] → 0.'] },
      { say: 'Nicole Oresme knew this in the fourteenth century. Grouping terms is a fine old trick.',
        lines: ['Another view (Oresme, c. 1350):', '1 + [[1@2]] + ([[1@3]] + [[1@4]]) + ([[1@5]] + ⋯ + [[1@8]]) + ⋯', '  ≥ 1 + [[1@2]] + [[1@2]] + [[1@2]] + ⋯', 'so  s_{2^m} ≥ 1 + [[m@2]] → ∞  as m → ∞.'] },
      { say: 'Squares behave much better. A telescoping bound and the Monotone Convergence Theorem.',
        lines: ['# Contrast:  ∑ 1/k^2', 'For k ≥ 2,  [[1@k^2]] < [[1@k(k − 1)]] = [[1@k − 1]] − [[1@k]],  so', 's_n ≤ 1 + (1 − [[1@n]]) < 2.  (s_n) is increasing and', 'bounded above, so it converges.', '(Its sum is [[π^2@6]], but that is another course.)'] },
      { say: 'And the same idea in general: the comparison test.',
        lines: ['* Comparison test.  If 0 ≤ a_k ≤ b_k for all k', '* and ∑ b_k converges, then ∑ a_k converges.', 'Proof.  The partial sums of ∑ a_k are', 'increasing, and bounded above by ∑ b_k.', 'Apply Monotone Convergence.   □'] },
      { say: "That's the week. Do the problem sheet, and do come and ask if anything's unclear. Thank you.",
        lines: ['# Summary', 'completeness  ⇒  Archimedean property,', 'Monotone Convergence,  Bolzano–Weierstrass,', 'and the Cauchy criterion.', 'Problem sheet 1 is on the course page.'] },
    ],
    quiz: [
      { q: 'In ℝ, a sequence is Cauchy if and only if it…', options: ['is bounded', 'is monotone', 'converges', 'tends to 0'], answer: 2 },
      { q: 'The harmonic series ∑ 1/k…', options: ['converges, to 2', 'converges, to π²/6', 'diverges, because 1/k does not tend to 0', 'diverges, even though 1/k → 0'], answer: 3 },
      { q: 'With sₙ = 1 + 1/2 + ⋯ + 1/n, for every n ∈ ℕ we have s₂ₙ − sₙ ≥ ?', options: ['1/2', '1', '2', 'n'], answer: 0 },
    ],
  },
];

/** Schedule on the shared REAL-time clock (game.time.now(), agreed by all players), independent of the game hour:
 *  one lecture per 12-minute slot, cycling through the four in order. The first LECTURE_SEC (10 min) is the lecture;
 *  the remaining 2 minutes have the finished boards up, the problem sheet out and people leaving. */
export const SLOT_MS = 12 * 60 * 1000;
export const LECTURE_SEC = 600;
/** {n, t, slot, msLeftInSlot}: t = seconds since the slot began / LECTURE_SEC (0..1 lecture, 1..1.2 break). */
export function lectureNow(nowMs) {
  const slot = Math.floor(nowMs / SLOT_MS), into = nowMs - slot * SLOT_MS;
  return { n: ((slot % LECTURES.length) + LECTURES.length) % LECTURES.length, t: into / 1000 / LECTURE_SEC, slot, msLeft: SLOT_MS - into };
}
/** "m:ss" */
export function mmss(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

/** Frame timing inside a lecture: the first 2% (12 s) is settling in, the last 3% wrapping up; boards share the rest
 *  equally (570 s / 12–14 boards = 41–48 s per board). */
export const FRAME_A = 0.02, FRAME_B = 0.97;
export function frameAt(lec, t) {
  const F = lec.frames.length, a = FRAME_A, b = FRAME_B;
  if (t < a) return { k: -1, p: 0 };
  if (t >= b) return { k: F, p: 1 };
  const u = ((t - a) / (b - a)) * F, k = Math.min(F - 1, Math.floor(u));
  return { k, p: u - k };
}
