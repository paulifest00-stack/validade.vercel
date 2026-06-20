CREATE TABLE public.product_catalog (
  barcode TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  photo_url TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public product_catalog is viewable by everyone." ON public.product_catalog FOR SELECT USING (TRUE);

CREATE POLICY "Users can insert their own product_catalog." ON public.product_catalog FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can update their own product_catalog." ON public.product_catalog FOR UPDATE USING (TRUE);

CREATE POLICY "Users can delete their own product_catalog." ON public.product_catalog FOR DELETE USING (TRUE);
