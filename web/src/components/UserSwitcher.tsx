import { ChevronDown } from "lucide-react";
import type { AppUser, UserId } from "../../shared/types";

export function UserSwitcher({
  users,
  value,
  onChange,
}: {
  users: AppUser[];
  value: UserId;
  onChange: (value: UserId) => void;
}) {
  const active = users.find((user) => user.userId === value);
  return (
    <label className="user-switcher" title={users.length > 1 ? "选择查看的档案" : "我的账号"}>
      <span className="user-switcher__avatar" aria-hidden="true">
        {active?.displayAlias.slice(0, 1) ?? "Y"}
      </span>
      <span>{active?.displayAlias ?? "YC"}</span>
      {users.length > 1 ? <ChevronDown aria-hidden="true" /> : null}
      <select aria-label="当前档案" disabled={users.length <= 1} value={value} onChange={(event) => onChange(event.target.value as UserId)}>
        {users.map((user) => (
          <option key={user.userId} value={user.userId}>
            {user.displayAlias}
          </option>
        ))}
      </select>
    </label>
  );
}
