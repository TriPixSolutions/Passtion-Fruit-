begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-media', 'message-media', false, 20971520,
  array[
    'image/jpeg','image/png','image/webp','image/gif',
    'audio/aac','audio/amr','audio/mpeg','audio/mp4','audio/ogg','audio/opus',
    'video/mp4','video/3gpp','application/pdf','application/octet-stream',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain'
  ]
)
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

commit;
