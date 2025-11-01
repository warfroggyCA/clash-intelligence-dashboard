-- Enable Row Level Security on background_jobs table
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

-- Create policy for background_jobs (only service role can access)
CREATE POLICY "Service role only" ON public.background_jobs
    FOR ALL USING (auth.role() = 'service_role');

-- Enable Row Level Security on war_plans table  
ALTER TABLE public.war_plans ENABLE ROW LEVEL SECURITY;

-- Create policy for war_plans (only service role can access)
CREATE POLICY "Service role only" ON public.war_plans
    FOR ALL USING (auth.role() = 'service_role');
