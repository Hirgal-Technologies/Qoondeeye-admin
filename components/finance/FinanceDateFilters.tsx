import { useDashboardFilters } from "../dashboard/DashboardFilters";
import { Filter } from "lucide-react";
import { CalendarDays } from "lucide-react";

export default function FinanceDateFilters() {
  const { days, fromDate, isCustomRange, setCustomRange, setDays, toDate } =
    useDashboardFilters();

  return (
    <section
      aria-labelledby="finance-filters-title"
      className="gradient-surface rounded-lg border p-4 shadow-[var(--shadow-card)] sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Filter aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h2 id="finance-filters-title" className="text-sm font-semibold">
            Filter financial activity
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Choose a quick range or use the calendar dates. Every metric and
            chart updates together.
          </p>
        </div>
      </div>

      <form
        key={`${fromDate}:${toDate}`}
        className="mt-4 grid gap-4 xl:grid-cols-[auto_1fr_auto] xl:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const fromInput = form.elements.namedItem("from") as HTMLInputElement;
          const toInput = form.elements.namedItem("to") as HTMLInputElement;

          toInput.setCustomValidity(
            fromInput.value > toInput.value
              ? "The end date must be on or after the start date."
              : "",
          );
          if (!form.reportValidity()) return;
          setCustomRange(fromInput.value, toInput.value);
        }}
      >
        <fieldset>
          <legend className="mb-2 text-[11px] font-medium text-muted-foreground">
            Quick range
          </legend>
          <div className="flex flex-wrap gap-2">
            {([7, 30, 90] as const).map((rangeDays) => {
              const active = !isCustomRange && days === rangeDays;
              return (
                <button
                  type="button"
                  key={rangeDays}
                  aria-pressed={active}
                  onClick={() => setDays(rangeDays)}
                  className={`min-h-10 rounded-md border px-3 text-xs font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                  }`}
                >
                  {rangeDays} days
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[11px] font-medium text-muted-foreground">
              From
            </span>
            <span className="relative block">
              <CalendarDays
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                name="from"
                type="date"
                required
                defaultValue={fromDate}
                onInput={(event) => event.currentTarget.setCustomValidity("")}
                className="min-h-10 w-full rounded-md border bg-card pl-9 pr-3 text-xs text-foreground outline-none transition-colors hover:border-primary/30 focus:border-primary"
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-[11px] font-medium text-muted-foreground">
              To
            </span>
            <span className="relative block">
              <CalendarDays
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                name="to"
                type="date"
                required
                defaultValue={toDate}
                onInput={(event) => event.currentTarget.setCustomValidity("")}
                className="min-h-10 w-full rounded-md border bg-card pl-9 pr-3 text-xs text-foreground outline-none transition-colors hover:border-primary/30 focus:border-primary"
              />
            </span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="gradient-button min-h-10 rounded-md px-4 text-xs font-semibold text-primary-foreground"
          >
            Apply dates
          </button>
          <button
            type="button"
            onClick={() => setDays(30)}
            className="min-h-10 rounded-md border bg-card px-4 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
          >
            Reset filters
          </button>
        </div>
      </form>
    </section>
  );
}
