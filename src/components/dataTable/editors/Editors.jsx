import TextEditor from "./TextEditor";
import NumberEditor from "./NumberEditor";
import DateEditor from "./DateEditor";
import SelectEditor from "./SelectEditor";
import TextareaEditor from "./TextareaEditor";
import LinkEditor from "./LinkEditor";
import "./Editors.scss";
import DateTimeEditor from "./DateTimeEditor";
import ImageUploadEditor from "./ImageUploadEditor";
import AsyncSelectEditor from "./AsyncSelectEditor";
import GoogleDriveEditor from "./GoogleDriveEditor";

export const editors = {
  text: TextEditor,
  number: NumberEditor,
  date: DateEditor,
  select: SelectEditor,
  textarea: TextareaEditor,
  link: LinkEditor,
  dateTime: DateTimeEditor,
  image: ImageUploadEditor,
  asyncSelect: AsyncSelectEditor,
  drivePicker: GoogleDriveEditor,
};
