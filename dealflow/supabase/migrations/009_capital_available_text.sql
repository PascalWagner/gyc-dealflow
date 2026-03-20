-- Change capital_available from numeric to text so we store the range label
-- (e.g. "$100k - $249k") instead of a midpoint number.
alter table user_goals
  alter column capital_available type text
  using case
    when capital_available < 100000 then '<$100k'
    when capital_available < 250000 then '$100k - $249k'
    when capital_available < 500000 then '$249k - $499k'
    when capital_available < 1000000 then '$500k - $999k'
    else '$1M+'
  end;
