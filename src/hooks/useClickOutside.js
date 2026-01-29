import { useEffect } from "react";

// useClickOutside.js
//
// Custom React Hook to detect and respond to clicks outside a specified DOM element.
//
// This hook handles:
// - Attaching a global event listener for 'mousedown' events.
// - Detecting whether a click occurred outside the passed `ref` element.
// - Invoking a provided `callback` function when an outside click is detected.
// - Automatically cleaning up event listeners on unmount.
//
// Reusable for modals, dropdowns, sidebars, or any component that needs to close on outside interaction.
//
// Usage in component/page:
// const [refNameIsOpen, setRefNameIsOpen] = useState(false)
// const refName = useRef();
// useClickOutside(refName, () => setIsOpen(false));
//
// <div useRef={refName}> ... <div/>
//
// Dependencies:
// - A valid React `ref` pointing to the target DOM element.
// - A callback function to execute when an outside click is detected.
//
// Future: can be extended with support for `touchstart`, conditional activation, or event type config.

export default function useClickOutside(ref, callback) {
  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        callback(); // click was outside the referenced element
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, callback]);
}
