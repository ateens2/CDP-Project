import { Slide, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const options = {
  position: "bottom-right",
  autoClose: 3000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  theme: "colored",
  transition: Slide,
};

export default class CustomToast {
  static success(message) {
    toast.success(message, options);
  }

  static error(message) {
    toast.error(message, options);
  }

  static info(message) {
    toast.info(message, options);
  }
}
