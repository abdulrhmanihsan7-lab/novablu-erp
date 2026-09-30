-- NovaBlu ERP Cloud Foundation (prepared for a future Supabase/Postgres deployment)
-- Not applied to any live database yet.

create extension if not exists pgcrypto;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  currency text not null default 'IQD',
  phone text,
  email text,
  tax_id text,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'Viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id,user_id)
);

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  city text,
  is_active boolean not null default true
);

create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  name text not null,
  code text,
  is_active boolean not null default true
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  governorate text,
  address text,
  tax_id text,
  tags text,
  credit_limit numeric(18,3) not null default 0,
  payment_terms text,
  created_at timestamptz not null default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  governorate text,
  address text,
  tax_id text,
  terms text,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name_ar text not null,
  name_en text,
  sku text not null,
  barcode text,
  brand text,
  unit text,
  cost numeric(18,3) not null default 0,
  price numeric(18,3) not null default 0,
  wholesale_price numeric(18,3) not null default 0,
  price_6 numeric(18,3) not null default 0,
  price_12 numeric(18,3) not null default 0,
  price_24 numeric(18,3) not null default 0,
  tax numeric(8,3) not null default 0,
  track_stock boolean not null default true,
  reorder_level numeric(18,3) not null default 0,
  lot_tracked boolean not null default false,
  serial_tracked boolean not null default false,
  expiry_tracked boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id,sku)
);

create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  number text not null,
  date date not null,
  valid_until date,
  status text not null default 'draft',
  amount numeric(18,3) not null default 0,
  notes text,
  unique(company_id,number)
);

create table if not exists sales_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  branch_id uuid references branches(id),
  warehouse_id uuid references warehouses(id),
  customer_id uuid references customers(id),
  quotation_id uuid references quotations(id),
  number text not null,
  date date not null,
  status text not null default 'draft',
  shipping numeric(18,3) not null default 0,
  discount numeric(18,3) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique(company_id,number)
);

create table if not exists sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references sales_orders(id) on delete cascade,
  product_id uuid references products(id),
  name text not null,
  qty numeric(18,3) not null,
  price numeric(18,3) not null,
  discount numeric(8,3) not null default 0,
  tax numeric(8,3) not null default 0
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  branch_id uuid references branches(id),
  warehouse_id uuid references warehouses(id),
  customer_id uuid references customers(id),
  sales_order_id uuid references sales_orders(id),
  number text not null,
  date date not null,
  status text not null default 'draft',
  shipping numeric(18,3) not null default 0,
  discount numeric(18,3) not null default 0,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,number)
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  product_id uuid references products(id),
  name text not null,
  color text,
  size text,
  qty numeric(18,3) not null,
  price numeric(18,3) not null,
  discount numeric(8,3) not null default 0,
  tax numeric(8,3) not null default 0
);

create table if not exists invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric(18,3) not null check(amount >= 0),
  method text not null,
  paid_at timestamptz not null default now()
);

create table if not exists stock_moves (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  warehouse_id uuid not null references warehouses(id),
  product_id uuid not null references products(id),
  move_type text not null,
  qty numeric(18,3) not null check(qty > 0),
  unit_cost numeric(18,3),
  ref text,
  note text,
  move_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  branch_id uuid references branches(id),
  warehouse_id uuid references warehouses(id),
  supplier_id uuid references suppliers(id),
  number text not null,
  order_date date not null,
  due_date date,
  status text not null default 'draft',
  supplier_invoice text,
  notes text,
  created_at timestamptz not null default now(),
  unique(company_id,number)
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  qty numeric(18,3) not null,
  cost numeric(18,3) not null,
  received_qty numeric(18,3) not null default 0
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function is_company_member(cid uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from memberships m
    where m.company_id=cid and m.user_id=auth.uid() and m.is_active=true
  );
$$;

alter table companies enable row level security;
alter table memberships enable row level security;
alter table branches enable row level security;
alter table warehouses enable row level security;
alter table customers enable row level security;
alter table suppliers enable row level security;
alter table products enable row level security;
alter table quotations enable row level security;
alter table sales_orders enable row level security;
alter table invoices enable row level security;
alter table stock_moves enable row level security;
alter table purchase_orders enable row level security;
alter table audit_logs enable row level security;

create policy companies_member_select on companies for select using (is_company_member(id));
create policy memberships_member_select on memberships for select using (user_id=auth.uid() or is_company_member(company_id));
create policy branches_member_all on branches for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy warehouses_member_all on warehouses for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy customers_member_all on customers for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy suppliers_member_all on suppliers for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy products_member_all on products for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy quotations_member_all on quotations for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy sales_orders_member_all on sales_orders for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy invoices_member_all on invoices for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy stock_moves_member_all on stock_moves for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy purchase_orders_member_all on purchase_orders for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy audit_logs_member_select on audit_logs for select using (is_company_member(company_id));

-- Child rows inherit tenant access through parent.
alter table sales_order_items enable row level security;
alter table invoice_items enable row level security;
alter table invoice_payments enable row level security;
alter table purchase_order_items enable row level security;

create policy soi_member_all on sales_order_items for all using (
  exists(select 1 from sales_orders s where s.id=sales_order_id and is_company_member(s.company_id))
) with check (
  exists(select 1 from sales_orders s where s.id=sales_order_id and is_company_member(s.company_id))
);
create policy invoice_items_member_all on invoice_items for all using (
  exists(select 1 from invoices i where i.id=invoice_id and is_company_member(i.company_id))
) with check (
  exists(select 1 from invoices i where i.id=invoice_id and is_company_member(i.company_id))
);
create policy invoice_payments_member_all on invoice_payments for all using (
  exists(select 1 from invoices i where i.id=invoice_id and is_company_member(i.company_id))
) with check (
  exists(select 1 from invoices i where i.id=invoice_id and is_company_member(i.company_id))
);
create policy poi_member_all on purchase_order_items for all using (
  exists(select 1 from purchase_orders p where p.id=purchase_order_id and is_company_member(p.company_id))
) with check (
  exists(select 1 from purchase_orders p where p.id=purchase_order_id and is_company_member(p.company_id))
);

create index if not exists idx_memberships_user_company on memberships(user_id,company_id);
create index if not exists idx_products_company_sku on products(company_id,sku);
create index if not exists idx_invoices_company_date on invoices(company_id,date);
create index if not exists idx_stock_moves_product_warehouse on stock_moves(product_id,warehouse_id);
create index if not exists idx_purchase_orders_company_date on purchase_orders(company_id,order_date);
