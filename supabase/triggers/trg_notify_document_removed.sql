create trigger trg_notify_document_removed
before delete on public.documents
for each row execute function public.notify_document_removed();
