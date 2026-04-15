import { useEffect, useState } from "react";

export default function NotificationPromptModal({ open, users = [], onCancel, onConfirm }) {
  const [mode, setMode] = useState("all");
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (open) {
      setMode("all");
      setSelected([]);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-lg">
        <h3 className="text-lg font-semibold">Send Notification</h3>
        <p className="text-sm text-slate-600 mt-1">Do you want to send the notification to all users or specific users?</p>
        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={mode === "all"} onChange={() => setMode("all")} />
            All users associated with this project
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={mode === "specific"} onChange={() => setMode("specific")} />
            Specific users
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={mode === "none"} onChange={() => setMode("none")} />
            Do not send notification
          </label>
        </div>

        {mode === "specific" && (
          <div className="border rounded p-2 mt-3 max-h-48 overflow-auto">
            {users.map((user) => (
              <label key={user.id} className="flex items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(user.id)}
                  onChange={(e) => {
                    setSelected((prev) =>
                      e.target.checked ? [...prev, user.id] : prev.filter((id) => id !== user.id)
                    );
                  }}
                />
                {user.fullName} <span className="text-slate-500">({user.email})</span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button className="border rounded px-3 py-1.5" onClick={onCancel}>Cancel</button>
          <button
            className="bg-indigo-600 text-white rounded px-3 py-1.5"
            onClick={() => onConfirm({ notifyMode: mode, notifyUserIds: selected })}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
