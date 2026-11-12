-- 0004_sift_rating_terms.sql
--
-- Each rating remembers which interest terms its tap moved.
--
-- Tap learning used to be accumulated into sift.interests rows (source 'taps')
-- with a read-modify-write per tap. Two concurrent taps could both read the old
-- weight and one nudge was lost, and flipping a verdict could only undo what
-- the CURRENT term set matched, not what the first tap moved. Now the weights
-- are DERIVED: for each term, the sum of verdict x 0.05 over this user's
-- ratings whose matched_terms contain it (lib/personal.ts tapWeights). A rating
-- row is upserted atomically per (user, pmid), its matched_terms are written
-- once on the first tap and kept on every re-tap, so flipping a verdict undoes
-- exactly what the first tap moved, and nothing accumulates anywhere.
alter table sift.ratings
  add column if not exists matched_terms text[] not null default '{}';
