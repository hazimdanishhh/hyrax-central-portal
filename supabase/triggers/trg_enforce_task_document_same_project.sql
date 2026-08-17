create trigger trg_enforce_task_document_same_project
before insert or update of task_id, document_id on public.task_documents
for each row execute function public.enforce_task_document_same_project();
