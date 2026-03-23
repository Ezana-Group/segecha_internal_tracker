export function Modal({ title, onSave, children, wide, S, closeModal, saveDisabled, saveLabel = "Save" }) {
    return (
        <div className="modal-overlay" style={S.ovl} onClick={closeModal}>
            <div
                className="modal-panel"
                style={{ ...S.mbox, width: wide ? "min(720px, 95vw)" : "min(min(560px, 100%), calc(100vw - 32px))" }}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="modal-panel-title">{title}</h2>
                <div className="modal-panel-body">{children}</div>
                <div className="modal-actions">
                    <button
                        style={{ ...S.btn("primary"), opacity: saveDisabled ? 0.5 : 1 }}
                        onClick={onSave}
                        disabled={saveDisabled}
                    >
                        {saveLabel}
                    </button>
                    <button type="button" style={S.btn("ghost")} onClick={closeModal}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
