import { useForm } from "react-hook-form";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const { register, handleSubmit } = useForm({ defaultValues: { email: "admin@discopain.local", password: "Password123!" } });
  const { login } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (values) => {
    await login(values);
    navigate("/");
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-100">
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-8 rounded-xl shadow w-full max-w-md space-y-4">
        <h2 className="text-2xl font-semibold">Sign In</h2>
        <input className="w-full border rounded px-3 py-2" placeholder="Email" {...register("email")} />
        <input className="w-full border rounded px-3 py-2" type="password" placeholder="Password" {...register("password")} />
        <button className="w-full py-2 rounded bg-indigo-600 text-white">Login</button>
      </form>
    </div>
  );
}
