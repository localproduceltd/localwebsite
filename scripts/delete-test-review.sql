-- Delete test review from feedback table
DELETE FROM feedback 
WHERE source = 'order_review' 
AND message ILIKE '%Lovely, test%';

-- Verify it's deleted
SELECT * FROM feedback WHERE source = 'order_review';
