create or replace trigger trg_notify_document_attached
after insert on public.task_documents
for each row execute function public.notify_document_attached();
