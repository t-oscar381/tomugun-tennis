import { setPetAction } from "@/app/actions";
import { PETS, petSrc } from "@/lib/pets";
import { Avatar } from "./avatar";

/**
 * Choose your face. One tap: each pet is its own submit button, so there is no
 * "select, then save" — the same reasoning as the sign-in slots.
 */
export function PetPicker({
  playerId,
  name,
  current,
  back,
  title = "Pick your pet",
}: {
  playerId: string;
  name: string;
  current: string | null;
  /** Where to land after choosing. Defaults to your player page. */
  back?: string;
  title?: string;
}) {
  return (
    <form action={setPetAction} className="space-y-4">
      {back && <input type="hidden" name="back" value={back} />}
      <div>
        <h2 className="text-xl">{title}</h2>
        <p className="mt-1 text-sm text-muted">
          Tap one and it becomes your picture everywhere — the scoreboard, the teams, the podium.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {PETS.map((p) => {
          const on = current === p.id;
          return (
            <button
              key={p.id}
              name="pet"
              value={p.id}
              aria-pressed={on}
              title={p.name}
              className={`rounded-2xl border p-1.5 transition-all hover:-translate-y-0.5 hover:border-clay ${
                on ? "border-clay bg-clay-soft ring-2 ring-clay" : "border-line bg-bg"
              }`}
            >
              <img src={petSrc(p.id)} alt={p.name} loading="lazy" className="aspect-square w-full object-contain" />
            </button>
          );
        })}
      </div>

      <button
        name="pet"
        value="none"
        className="flex items-center gap-2.5 text-sm font-semibold text-muted hover:text-ink"
      >
        <Avatar id={playerId} name={name} size={30} />
        {back ? "Skip — just use my initials" : "Use my initials instead"}
      </button>
    </form>
  );
}
