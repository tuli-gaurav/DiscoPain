import { useNavigate } from "react-router-dom";

export default function BackButton({ fallbackTo = "/", label = "Back" }) {
  const navigate = useNavigate();

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(fallbackTo);
  };

  return (
    <button
      type="button"
      className="border rounded-lg px-3 py-1.5 text-sm bg-white/90 hover:bg-white"
      onClick={goBack}
    >
      ← {label}
    </button>
  );
}
