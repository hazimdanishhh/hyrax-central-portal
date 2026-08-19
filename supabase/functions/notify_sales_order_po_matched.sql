-- arguments: none (trigger function)
-- returns: trigger
--
-- Fires once per genuinely NEW row in sap_sales_orders (synced by
-- hyrax-data-platform's sales_orders.py via upsert ON CONFLICT (doc_entry)
-- DO UPDATE -- Postgres only routes a brand-new doc_entry through the
-- INSERT trigger path, same guarantee auto_create_sales_rep_mapping.sql
-- already relies on for sap_sales_persons). If the new order's customer_ref
-- (SAP NumAtCard) matches an existing sales_leads.po_number, notifies that
-- lead's owner -- in-app and by email -- via the existing event pipeline
-- (see docs/NOTIFICATIONS-ARCHITECTURE.md).
--
-- No SECURITY DEFINER: sap_sales_orders is written via the pipeline's
-- service-role key, which already bypasses RLS for this transaction,
-- matching auto_create_sales_rep_mapping.sql's own (also non-SECURITY-
-- DEFINER) precedent for a trigger on a sap_* table.
create or replace function public.notify_sales_order_po_matched()
returns trigger
language plpgsql
as $$
declare
    v_lead record;
    v_lead_owner_profile_id uuid;
begin
    if new.customer_ref is null or btrim(new.customer_ref) = '' then
        return new; -- no PO on this order -- nothing to match
    end if;

    select sl.id, sl.title, sl.lead_owner_id
      into v_lead
      from public.sales_leads sl
      where sl.po_number = new.customer_ref;

    if v_lead.id is null then
        return new; -- no lead's PO matches this order
    end if;

    -- lead_owner_id is employees.id, not profiles.id -- resolve it, same as
    -- notify_task_assigned.sql/check_employee_confirmations_due_soon.sql.
    select e.profile_id into v_lead_owner_profile_id
      from public.employees e
      where e.id = v_lead.lead_owner_id;

    if v_lead_owner_profile_id is null then
        return new; -- lead owner has no linked portal profile -- nobody to notify
    end if;

    begin
        perform public.emit_notification_event(
            'sales_order.po_matched',
            'sap_sales_orders',
            new.doc_entry::text,
            jsonb_build_object(
                'doc_entry', new.doc_entry,
                'so_number', new.so_number,
                'po_number', new.customer_ref,
                'customer_name', new.customer_name,
                'lead_id', v_lead.id,
                'lead_owner_profile_id', v_lead_owner_profile_id,
                'title', 'SAP Sales Order Created for Your Lead',
                'message', format(
                    'SAP sales order SO-%s (PO %s) has been created for your lead "%s".',
                    new.so_number, new.customer_ref, v_lead.title
                ),
                'link_to', '/app/sales/leads/list/' || v_lead.id
            )
        );
    exception when others then
        raise warning 'sales_order.po_matched notification failed for doc_entry %: %',
            new.doc_entry, sqlerrm;
    end;

    return new;
end;
$$;
