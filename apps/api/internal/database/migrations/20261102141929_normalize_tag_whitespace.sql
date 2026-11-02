-- +goose Up
LOCK TABLE tags, meme_tags, memes IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE tag_merge ON COMMIT DROP AS
SELECT id,name,cleaned_name,lower(cleaned_name) AS key,
 first_value(id) OVER (PARTITION BY lower(cleaned_name) ORDER BY (name=cleaned_name) DESC,created_at,id) AS keep_id
FROM (SELECT id,name,created_at,normalize(translate(name, U&'\0009\000A\000B\000C\000D\0020\0085\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000', ''),NFC) AS cleaned_name FROM tags) clean;
-- +goose StatementBegin
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM tag_merge WHERE cleaned_name='') THEN
  RAISE EXCEPTION 'Cannot normalize an empty tag';
 END IF;
END $$;
-- +goose StatementEnd
UPDATE memes SET content_revision=content_revision+1,updated_at=now()
WHERE id IN (SELECT mt.meme_id FROM meme_tags mt JOIN tag_merge t ON t.id=mt.tag_id WHERE t.name<>t.cleaned_name OR t.id<>t.keep_id);
INSERT INTO meme_tags(meme_id,tag_id,source,created_at)
SELECT mt.meme_id,t.keep_id,CASE WHEN bool_or(mt.source='user') THEN 'user' ELSE 'ai' END,min(mt.created_at)
FROM meme_tags mt JOIN tag_merge t ON t.id=mt.tag_id GROUP BY mt.meme_id,t.keep_id
ON CONFLICT(meme_id,tag_id) DO UPDATE SET
 source=CASE WHEN meme_tags.source='user' OR excluded.source='user' THEN 'user' ELSE 'ai' END,
 created_at=LEAST(meme_tags.created_at,excluded.created_at);
DELETE FROM tags WHERE id IN (SELECT id FROM tag_merge WHERE id<>keep_id);
UPDATE tags t SET name=m.cleaned_name,normalized_name=m.key,updated_at=now()
FROM tag_merge m WHERE t.id=m.id AND m.id=m.keep_id AND (t.name<>m.cleaned_name OR t.normalized_name<>m.key);
ALTER TABLE tags ADD CONSTRAINT tags_no_whitespace CHECK (name=normalize(translate(name, U&'\0009\000A\000B\000C\000D\0020\0085\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000', ''),NFC));

-- +goose Down
-- Merged tag names and associations cannot be split automatically.
ALTER TABLE tags DROP CONSTRAINT tags_no_whitespace;
