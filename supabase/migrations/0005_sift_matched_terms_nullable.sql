-- 0005_sift_matched_terms_nullable.sql
--
-- ratings.matched_terms: NULL now means "not computed": the server recomputes
-- it from the stored paper and the current Obsidian/manual terms (and writes it
-- on the next tap). An empty array still means "computed, matched nothing".
-- With the 0004 default of '{}' the two were indistinguishable, so a rating
-- made before any interest terms existed would never learn. (Verified before
-- applying: sift.ratings had 0 rows, so no '{}' row needed back-filling.)
--
-- Both statements are no-ops when already applied, so the file is re-runnable.
alter table sift.ratings
  alter column matched_terms drop not null;
alter table sift.ratings
  alter column matched_terms drop default;
