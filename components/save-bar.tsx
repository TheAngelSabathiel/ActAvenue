"use client";

/** "Save changes" footer for an edit form. Disabled until something changed. */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-ink/10">
      <button type="button" onClick={onSave} disabled={!dirty || saving} className="aa-btn aa-btn-sm disabled:opacity-40">
        {saving ? "Saving..." : "Save changes"}
      </button>
      {dirty && !saving && (
        <>
          <button type="button" onClick={onDiscard} className="aa-btn aa-btn-outline aa-btn-sm">
            Discard
          </button>
          <span className="text-xs font-bold text-danger">Unsaved changes</span>
        </>
      )}
    </div>
  );
}
