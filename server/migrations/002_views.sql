-- Read-only views that turn each student's document into rows, for analysis
-- (feedback loop, which employers lead to interviews) with plain SQL. Standard Postgres jsonb functions.
CREATE OR REPLACE VIEW student_profiles AS
SELECT w.user_id,
       u.kind AS account_kind,
       w.data->'profile'->>'school'           AS school,
       w.data->'profile'->>'major'            AS major,
       w.data->'profile'->>'classYear'        AS class_year,
       w.data->'profile'->>'graduation'       AS graduation,
       w.data->'profile'->>'targetRoles'      AS target_roles,
       w.data->'profile'->>'regions'          AS regions,
       w.data->'profile'->>'opportunityTypes' AS opportunity_types,
       w.data->'profile'->>'timeline'         AS timeline,
       (w.data->'onboarding'->>'done')::boolean AS setup_done,
       w.data->'resume' IS NOT NULL           AS has_resume,
       w.updated_at
FROM workspaces w JOIN users u ON u.id = w.user_id;

-- One row per application the student is tracking, with its latest status.
CREATE OR REPLACE VIEW tracked_applications AS
SELECT w.user_id,
       t->>'id'      AS item_id,
       t->>'company' AS company,
       t->>'role'    AS role,
       t->>'status'  AS status,
       jsonb_array_length(COALESCE(t->'events', '[]'::jsonb)) AS status_changes
FROM workspaces w, jsonb_array_elements(COALESCE(w.data->'tracker', '[]'::jsonb)) AS t;

-- One row per opening in a student's list, with where it came from.
CREATE OR REPLACE VIEW student_openings AS
SELECT w.user_id,
       j->>'id'         AS job_id,
       j->>'company'    AS company,
       j->>'title'      AS title,
       j->>'location'   AS location,
       j->>'kind'       AS kind,
       j->>'origin'     AS origin,
       j->>'sourceName' AS source,
       (w.data->'fits'->(j->>'id')->>'excluded')::boolean AS hidden_by_filters,
       (w.data->'fits'->(j->>'id')->>'score')::int        AS fit_score
FROM workspaces w, jsonb_array_elements(COALESCE(w.data->'jobs', '[]'::jsonb)) AS j;
