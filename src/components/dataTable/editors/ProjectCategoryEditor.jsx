import { forwardRef } from "react";
import CreatableSelect from "react-select/creatable";
import { useProjectCategories, useCreateProjectCategory } from "../../../features/workspace/projects/private/hooks/useProjectCategories";

// The on-the-fly category creation the product owner asked for -- "the
// frontend should work like sales leads/prospects, where users can add a
// new category if it doesn't exist". Simpler than Sales'
// LeadAccountEditor.jsx (hand-rolled __create-flag + inline sub-form),
// since a category needs only a name, no required side-fields -- so this
// uses react-select's own Creatable variant directly (bundled in the
// already-installed react-select package, no new dependency) instead of
// reinventing that flow. Options are a small, in-memory list (categories
// are a bounded, shared taxonomy) -- no async/remote search needed.
const ProjectCategoryEditor = forwardRef(
  ({ value, onChange, onBlur, readOnly, isClearable = true, name }, ref) => {
    const { categories } = useProjectCategories();
    const { createCategory, creating } = useCreateProjectCategory();

    const options = categories.map((c) => ({ label: c.name, value: c.id }));
    const selected = options.find((opt) => String(opt.value) === String(value)) || null;

    const handleCreate = async (rawName) => {
      const newId = await createCategory(rawName);
      onChange(newId);
    };

    return (
      <CreatableSelect
        ref={ref}
        name={name}
        onBlur={onBlur}
        unstyled
        className="selectContainer"
        classNamePrefix="reactSelect"
        placeholder="Select or type to create a category..."
        isClearable={isClearable}
        isDisabled={readOnly || creating}
        isLoading={creating}
        options={options}
        value={selected}
        onChange={(selectedOption) => {
          onChange(selectedOption ? selectedOption.value : "");
        }}
        onCreateOption={handleCreate}
        formatCreateLabel={(inputValue) => `Create new category "${inputValue}"`}
      />
    );
  },
);

export default ProjectCategoryEditor;
