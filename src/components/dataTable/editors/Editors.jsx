import TextEditor from "./TextEditor";
import NumberEditor from "./NumberEditor";
import DateEditor from "./DateEditor";
import SelectEditor from "./SelectEditor";
import TextareaEditor from "./TextareaEditor";
import LinkEditor from "./LinkEditor";

export const editors = {
  text: TextEditor,
  number: NumberEditor,
  date: DateEditor,
  select: SelectEditor,
  textarea: TextareaEditor,
  link: LinkEditor,
};
