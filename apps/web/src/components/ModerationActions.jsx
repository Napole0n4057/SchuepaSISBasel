import { useState } from "react";
export default function ModerationActions({
  resource,
  item,
  t,
  onChanged,
  allowDelete = true,
}) {
  const [error, setError] = useState(null);
  async function mutate(action) {
    let body = { id: item.id };
    if (action === "update") {
      if (resource !== "forum/comments") {
        body.title = window.prompt(t("Title"), item.title);
        if (body.title === null) return;
      }
      body.content = window.prompt(t("Content"), item.content);
      if (body.content === null) return;
    } else if (!window.confirm(t("Delete this post?"))) return;
    try {
      const response = await fetch(`/api/${resource}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setError(null);
      onChanged(data.item);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => mutate("update")}
        className="rounded-md border border-gray-300 px-3 py-1 text-xs"
      >
        {t("Edit")}
      </button>
      {allowDelete && (
        <button
          type="button"
          onClick={() => mutate("delete")}
          className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-700"
        >
          {t("Remove post")}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t(error)}
        </p>
      )}
    </div>
  );
}
