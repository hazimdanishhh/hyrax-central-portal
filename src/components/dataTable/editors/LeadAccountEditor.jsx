import { forwardRef, useState } from "react";
import AsyncSelect from "react-select/async";
import Select from "react-select";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import Button from "../../buttons/button/Button";
import CardLayout from "../../cardLayout/CardLayout";
import { useMessage } from "../../../context/MessageContext";
import { useClientsMetadata } from "../../../features/sales/clients/private/hooks/useClientsMetadata";
import useClientMutations from "../../../features/sales/clients/private/hooks/useClientMutations";

// Unified SAP-customer + Prospect picker for a Lead's account (2026-08) --
// a lead references exactly one of a real SAP customer or a native
// Prospect, never a local mirror of an SAP customer (see
// leadAccountSearch.js). Selecting the "+ Create new prospect"
// pseudo-option switches this editor into a small inline create form
// instead of setting the field directly, so a salesperson never has to
// leave the Lead form to add a brand-new prospect -- once created, the
// real onChange fires with the new prospect tagged the same way a picked
// option would be.
const LeadAccountEditor = forwardRef(
  (
    {
      value,
      onChange,
      loadOptions,
      formatOptionLabel,
      isClearable = true,
      readOnly,
      name,
      onBlur,
    },
    ref,
  ) => {
    const [creating, setCreating] = useState(null); // { name: string } | null
    const [industryId, setIndustryId] = useState(null);
    const { industries } = useClientsMetadata();
    const { createClient, creating: saving } = useClientMutations();
    const { showMessage } = useMessage();

    const handleSelect = (option) => {
      if (option?.__create) {
        setCreating({ name: option.searchTerm });
        return;
      }
      onChange(option);
    };

    const handleCreate = async () => {
      if (!industryId) {
        showMessage("Industry is required", "warning");
        return;
      }
      const client = await createClient({
        name: creating.name,
        industry_id: industryId.value,
      });
      onChange({ __type: "prospect", value: client.id, label: client.name });
      setCreating(null);
      setIndustryId(null);
    };

    if (creating) {
      return (
        <CardLayout style="generalCard cardPaddingSmall cardGapSmall">
          <p className="textRegular textXS">
            Create new prospect &quot;{creating.name}&quot;
          </p>
          <Select
            unstyled
            className="selectContainer"
            classNamePrefix="reactSelect"
            placeholder="Select industry..."
            value={industryId}
            onChange={setIndustryId}
            options={industries.map((i) => ({ label: i.name, value: i.id }))}
          />
          <div className="dataFormFooter">
            <Button
              name="Cancel"
              icon={XIcon}
              type="button"
              style="button buttonType5 textXXS textRegular"
              size={14}
              disabled={saving}
              onClick={() => {
                setCreating(null);
                setIndustryId(null);
              }}
            />
            <Button
              name="Create & Link"
              icon={CheckIcon}
              type="button"
              style="button buttonType5 approval textXXS textRegular"
              size={14}
              disabled={saving}
              onClick={handleCreate}
            />
          </div>
        </CardLayout>
      );
    }

    return (
      <AsyncSelect
        ref={ref}
        name={name}
        onBlur={onBlur}
        unstyled
        className="selectContainer"
        classNamePrefix="reactSelect"
        cacheOptions
        defaultOptions
        loadOptions={loadOptions}
        placeholder="Search SAP customers or prospects..."
        isClearable={isClearable}
        value={value}
        onChange={handleSelect}
        isDisabled={readOnly}
        formatOptionLabel={formatOptionLabel}
      />
    );
  },
);

export default LeadAccountEditor;
