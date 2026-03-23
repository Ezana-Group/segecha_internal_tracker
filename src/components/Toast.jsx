const LABELS = { success: "Done", error: "Error", warning: "Notice" };

export function ToastContainer({ toasts }) {
    return (
        <div className="toast-stack" role="status" aria-live="polite">
            {toasts.map((t) => {
                const kind = t.type === "error" ? "error" : t.type === "warning" ? "warning" : "success";
                return (
                    <div key={t.id} className={`toast-item toast-item--${kind}`}>
                        <div className="toast-item-label">{LABELS[kind]}</div>
                        <div>{t.message}</div>
                    </div>
                );
            })}
        </div>
    );
}
