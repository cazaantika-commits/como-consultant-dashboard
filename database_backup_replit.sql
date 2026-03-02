--
-- PostgreSQL database dump
--

\restrict Ehcueqol7NpvsIIwqQgT6epS8kkfq2M8Zk7rkg2mQTvSpi4e9HRDdTYrQxX4b60

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: access_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.access_method AS ENUM (
    'manual_file',
    'drive_sync',
    'api',
    'scrape'
);


--
-- Name: agent_run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.agent_run_status AS ENUM (
    'queued',
    'running',
    'completed',
    'failed'
);


--
-- Name: agent_run_trigger; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.agent_run_trigger AS ENUM (
    'manual',
    'document_upload',
    'ipc_created',
    'cron_nightly',
    'cron_weekly',
    'event_chain'
);


--
-- Name: agent_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.agent_status AS ENUM (
    'active',
    'coming_soon',
    'disabled'
);


--
-- Name: agent_task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.agent_task_status AS ENUM (
    'queued',
    'in_progress',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: ai_data_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ai_data_status AS ENUM (
    'Pending',
    'Approved',
    'Rejected'
);


--
-- Name: alert_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alert_severity AS ENUM (
    'info',
    'warning',
    'critical'
);


--
-- Name: board_recommendation; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.board_recommendation AS ENUM (
    'go',
    'go_with_adjustment',
    'hold',
    'no_go'
);


--
-- Name: budget_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.budget_category AS ENUM (
    'land_costs',
    'design_consultancy',
    'government_fees',
    'construction',
    'rera_registration',
    'marketing_sales',
    'financial_admin'
);


--
-- Name: capital_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.capital_event_type AS ENUM (
    'EQUITY_INJECT',
    'ESCROW_DEPOSIT',
    'ESCROW_RELEASE',
    'BURN_PAYMENT',
    'RETENTION_HOLD',
    'RETENTION_RELEASE',
    'VO_COST',
    'SALES_RECEIPT'
);


--
-- Name: capital_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.capital_state AS ENUM (
    'C1',
    'C2',
    'C3',
    'C4',
    'C5'
);


--
-- Name: cash_flow_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cash_flow_source AS ENUM (
    'equity',
    'bank_finance',
    'sales',
    'other'
);


--
-- Name: cash_flow_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cash_flow_type AS ENUM (
    'outflow',
    'inflow'
);


--
-- Name: competitor_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.competitor_status AS ENUM (
    'launched',
    'under_construction',
    'ready',
    'sold_out'
);


--
-- Name: confidence_grade; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.confidence_grade AS ENUM (
    'A',
    'B',
    'C'
);


--
-- Name: confidence_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.confidence_level AS ENUM (
    'high',
    'medium',
    'low'
);


--
-- Name: conflict_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.conflict_status AS ENUM (
    'unresolved',
    'resolved_auto',
    'resolved_owner'
);


--
-- Name: contract_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contract_status AS ENUM (
    'DRAFT',
    'TENDERING',
    'AWARDED',
    'ACTIVE',
    'COMPLETED',
    'TERMINATED'
);


--
-- Name: dataset_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dataset_type AS ENUM (
    'transactions',
    'rents',
    'projects',
    'listings',
    'competitor',
    'macro',
    'research',
    'other'
);


--
-- Name: dependency_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dependency_type AS ENUM (
    'REQUIRED',
    'RECOMMENDED'
);


--
-- Name: directive_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.directive_type AS ENUM (
    'inquiry',
    'report_request',
    'instruction',
    'other'
);


--
-- Name: doc_classification; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.doc_classification AS ENUM (
    'CONTRACT_MAIN_WORKS',
    'CONTRACT_SUBCONTRACT',
    'QS_COST_PLAN',
    'TCC_CERTIFICATION',
    'IPC_CERTIFICATE',
    'VO_REQUEST',
    'VO_APPROVAL',
    'RERA_ESCROW_DOC',
    'DLD_DOC',
    'DM_PLANNING_APPROVAL',
    'DM_BUILDING_PERMIT',
    'CIVIL_DEFENSE_APPROVAL',
    'DEWA_NOC',
    'MASTER_DEVELOPER_NOC',
    'OQOOD_EXPORT',
    'SALES_TRACKER',
    'RECEIPT_PROOF',
    'HANDOVER_CHECKLIST',
    'COMPLETION_CERTIFICATE',
    'OA_TRANSFER_DOC',
    'DLP_LOG',
    'UNKNOWN'
);


--
-- Name: document_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.document_type AS ENUM (
    'csv',
    'pdf',
    'brochure',
    'screenshot',
    'excel',
    'other'
);


--
-- Name: draft_decision_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.draft_decision_status AS ENUM (
    'draft',
    'pending_review',
    'approved',
    'rejected'
);


--
-- Name: expense_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.expense_category AS ENUM (
    'Soft Cost',
    'Hard Cost'
);


--
-- Name: gate_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.gate_status AS ENUM (
    'PENDING',
    'PASSED',
    'FAILED',
    'OVERRIDDEN'
);


--
-- Name: inquiry_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.inquiry_status AS ENUM (
    'open',
    'answered',
    'escalated'
);


--
-- Name: ipc_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ipc_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'REVIEWED',
    'APPROVED',
    'PAID',
    'DISPUTED'
);


--
-- Name: knowledge_domain; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.knowledge_domain AS ENUM (
    'rera_law',
    'dubai_municipality',
    'building_codes',
    'market_prices',
    'company_context',
    'project_standards',
    'general'
);


--
-- Name: lifecycle_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lifecycle_state AS ENUM (
    'S0_ACTIVATED',
    'S1_CONSULTANTS_PROCURED',
    'S2_DESIGN_IN_PROGRESS',
    'S3_REGULATORY_IN_PROGRESS',
    'S4_READY_FOR_TENDER',
    'S5_TENDER_IN_PROGRESS',
    'S6_CONTRACT_AWARDED',
    'S7_SALES_READY',
    'S8_SALES_ACTIVE',
    'S9_CONSTRUCTION_ACTIVE',
    'S10_NEAR_COMPLETION',
    'S11_HANDOVER',
    'S12_OA_TRANSFER',
    'S13_DLP_ACTIVE',
    'S14_CLOSED'
);


--
-- Name: project_risk_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_risk_level AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);


--
-- Name: project_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_status AS ENUM (
    'Pre-study',
    'Design',
    'Permits',
    'Tendering',
    'Active',
    'Sales',
    'Completed',
    'Completed (Handover)'
);


--
-- Name: proposal_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.proposal_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'expired'
);


--
-- Name: regulatory_node_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.regulatory_node_type AS ENUM (
    'DLD_TITLE',
    'RERA_DEV_REG',
    'ESCROW_OPENING',
    'QS_TCC_CERT',
    'MUNICIPALITY_PLANNING',
    'BUILDING_PERMIT',
    'CIVIL_DEFENSE',
    'DEWA_NOC',
    'MASTER_DEV_NOC',
    'OQOOD_ACTIVATION',
    'PROJECT_REG_RERA',
    'COMPLETION_CERT',
    'UNIT_TITLE_ISSUANCE'
);


--
-- Name: regulatory_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.regulatory_status AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'EXPIRED'
);


--
-- Name: report_version_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.report_version_status AS ENUM (
    'draft',
    'governed',
    'board_issue'
);


--
-- Name: request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.request_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'needs_info'
);


--
-- Name: request_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.request_type AS ENUM (
    'consultant',
    'contractor',
    'financing',
    'pricing',
    'budget',
    'schedule',
    'other'
);


--
-- Name: risk_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.risk_level AS ENUM (
    'green',
    'yellow',
    'red'
);


--
-- Name: scenario_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.scenario_type AS ENUM (
    'base',
    'optimistic',
    'conservative',
    'custom'
);


--
-- Name: source_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.source_tier AS ENUM (
    'tier1_official',
    'tier2_primary',
    'tier3_professional',
    'tier4_listings',
    'tier5_macro'
);


--
-- Name: task_phase; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_phase AS ENUM (
    'Pre-Construction',
    'Construction',
    'Handover'
);


--
-- Name: unit_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.unit_status AS ENUM (
    'AVAILABLE',
    'RESERVED',
    'SOLD',
    'HANDED_OVER',
    'CANCELLED'
);


--
-- Name: vo_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vo_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'IMPLEMENTED'
);


--
-- Name: vo_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vo_type AS ENUM (
    'VO_A_DEVELOPER',
    'VO_B_AUTHORITY',
    'VO_C_CONTRACTOR'
);


--
-- Name: wallet_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wallet_type AS ENUM (
    'Wallet_A',
    'Wallet_B'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_outputs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_outputs (
    id integer NOT NULL,
    run_id integer NOT NULL,
    agent_id character varying NOT NULL,
    output_type text NOT NULL,
    output_data jsonb NOT NULL,
    summary text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_outputs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agent_outputs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agent_outputs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agent_outputs_id_seq OWNED BY public.agent_outputs.id;


--
-- Name: agent_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_runs (
    id integer NOT NULL,
    agent_id character varying NOT NULL,
    project_id character varying,
    trigger public.agent_run_trigger DEFAULT 'manual'::public.agent_run_trigger NOT NULL,
    trigger_ref text,
    status public.agent_run_status DEFAULT 'queued'::public.agent_run_status NOT NULL,
    input_context jsonb,
    duration_ms integer,
    error_message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone
);


--
-- Name: agent_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agent_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agent_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agent_runs_id_seq OWNED BY public.agent_runs.id;


--
-- Name: agent_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_tasks (
    id integer NOT NULL,
    from_agent_id character varying,
    to_agent_id character varying NOT NULL,
    project_id character varying,
    task_type text NOT NULL,
    title text NOT NULL,
    payload text,
    result text,
    status public.agent_task_status DEFAULT 'queued'::public.agent_task_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone
);


--
-- Name: agent_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agent_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agent_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agent_tasks_id_seq OWNED BY public.agent_tasks.id;


--
-- Name: ai_advisory_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_advisory_scores (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    consultant_id integer NOT NULL,
    criterion_id integer NOT NULL,
    suggested_score integer,
    reasoning text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_advisory_scores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_advisory_scores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_advisory_scores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_advisory_scores_id_seq OWNED BY public.ai_advisory_scores.id;


--
-- Name: ai_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_agents (
    id character varying NOT NULL,
    name_en text NOT NULL,
    name_ar text NOT NULL,
    role_en text NOT NULL,
    role_ar text NOT NULL,
    description_en text NOT NULL,
    description_ar text NOT NULL,
    avatar_url text,
    avatar_color text DEFAULT '#F59E0B'::text NOT NULL,
    avatar_initial text DEFAULT 'A'::text NOT NULL,
    system_prompt text,
    tool_ids text[],
    capabilities text[],
    status public.agent_status DEFAULT 'coming_soon'::public.agent_status NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_market_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_market_data (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_id character varying NOT NULL,
    data_type text NOT NULL,
    value numeric(14,2) NOT NULL,
    previous_value numeric(14,2),
    unit text DEFAULT 'AED/sqft'::text NOT NULL,
    source text DEFAULT 'AI Agent'::text NOT NULL,
    insight text NOT NULL,
    impact_description text,
    status public.ai_data_status DEFAULT 'Pending'::public.ai_data_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id integer NOT NULL,
    run_id integer,
    agent_id character varying NOT NULL,
    project_id character varying,
    severity public.alert_severity DEFAULT 'info'::public.alert_severity NOT NULL,
    title_en text NOT NULL,
    title_ar text NOT NULL,
    message_en text NOT NULL,
    message_ar text NOT NULL,
    metric text,
    current_value text,
    threshold text,
    acknowledged boolean DEFAULT false NOT NULL,
    acknowledged_by text,
    acknowledged_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.alerts_id_seq OWNED BY public.alerts.id;


--
-- Name: approval_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_requests (
    id integer NOT NULL,
    project_id character varying,
    type public.request_type NOT NULL,
    title text NOT NULL,
    title_ar text NOT NULL,
    description text NOT NULL,
    recommendation text,
    status public.request_status DEFAULT 'pending'::public.request_status NOT NULL,
    response_note text,
    responded_by text,
    responded_at timestamp without time zone,
    created_by text DEFAULT 'developer_director'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: approval_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approval_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approval_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approval_requests_id_seq OWNED BY public.approval_requests.id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id integer NOT NULL,
    project_id character varying,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    previous_value text,
    new_value text,
    performed_by text DEFAULT 'system'::text NOT NULL,
    metadata text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: board_decision_view; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.board_decision_view (
    id integer NOT NULL,
    project_id character varying,
    decision_type text NOT NULL,
    title text NOT NULL,
    title_ar text,
    summary text,
    summary_ar text,
    recommendation text,
    status text DEFAULT 'pending'::text,
    decided_by text,
    decided_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: board_decision_view_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.board_decision_view_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: board_decision_view_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.board_decision_view_id_seq OWNED BY public.board_decision_view.id;


--
-- Name: board_portfolio_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.board_portfolio_cache (
    id integer NOT NULL,
    total_projects integer DEFAULT 0 NOT NULL,
    total_gdv numeric(16,2) DEFAULT '0'::numeric,
    total_tdc numeric(16,2) DEFAULT '0'::numeric,
    avg_roi numeric(8,2) DEFAULT '0'::numeric,
    portfolio_health_grade text DEFAULT 'B'::text,
    c1_total integer DEFAULT 0,
    c2_total integer DEFAULT 0,
    c3_total integer DEFAULT 0,
    c4_total integer DEFAULT 0,
    c5_total integer DEFAULT 0,
    risk_summary jsonb,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: board_portfolio_cache_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.board_portfolio_cache_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: board_portfolio_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.board_portfolio_cache_id_seq OWNED BY public.board_portfolio_cache.id;


--
-- Name: board_project_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.board_project_cache (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    project_name text NOT NULL,
    project_name_ar text,
    location text,
    status text,
    gdv numeric(16,2) DEFAULT '0'::numeric,
    tdc numeric(16,2) DEFAULT '0'::numeric,
    roi numeric(8,2) DEFAULT '0'::numeric,
    risk_level text DEFAULT 'LOW'::text,
    physical_progress integer DEFAULT 0,
    sales_progress integer DEFAULT 0,
    capital_state jsonb,
    executive_summary text,
    executive_summary_ar text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: board_project_cache_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.board_project_cache_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: board_project_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.board_project_cache_id_seq OWNED BY public.board_project_cache.id;


--
-- Name: capital_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capital_balances (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    c1_free_equity integer DEFAULT 0 NOT NULL,
    c2_committed_equity integer DEFAULT 0 NOT NULL,
    c3_escrow_locked integer DEFAULT 0 NOT NULL,
    c4_deployed_burn integer DEFAULT 0 NOT NULL,
    c5_retention_held integer DEFAULT 0 NOT NULL,
    liquidity_real integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: capital_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.capital_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: capital_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.capital_balances_id_seq OWNED BY public.capital_balances.id;


--
-- Name: capital_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capital_events (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    event_type public.capital_event_type NOT NULL,
    amount integer NOT NULL,
    from_state public.capital_state,
    to_state public.capital_state,
    description text,
    reference_id text,
    reference_type text,
    created_by text DEFAULT 'system'::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: capital_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.capital_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: capital_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.capital_events_id_seq OWNED BY public.capital_events.id;


--
-- Name: chat_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_history (
    id integer NOT NULL,
    agent text DEFAULT 'salwa'::text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_history_id_seq OWNED BY public.chat_history.id;


--
-- Name: command_center_inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.command_center_inquiries (
    id integer NOT NULL,
    project_id character varying,
    sender_role text NOT NULL,
    sender_name text NOT NULL,
    message text NOT NULL,
    response text,
    responded_by text,
    status public.inquiry_status DEFAULT 'open'::public.inquiry_status NOT NULL,
    escalated_to_owner boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    responded_at timestamp without time zone
);


--
-- Name: command_center_inquiries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.command_center_inquiries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: command_center_inquiries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.command_center_inquiries_id_seq OWNED BY public.command_center_inquiries.id;


--
-- Name: committee_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.committee_decisions (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    selected_consultant_id integer,
    decision_type text,
    decision_basis text,
    justification text,
    negotiation_target text,
    negotiation_conditions text,
    committee_notes text,
    ai_analysis text,
    ai_recommendation text,
    ai_post_decision_analysis text,
    is_confirmed boolean DEFAULT false,
    confirmed_at timestamp without time zone,
    confirmed_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: committee_decisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.committee_decisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: committee_decisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.committee_decisions_id_seq OWNED BY public.committee_decisions.id;


--
-- Name: competitor_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitor_projects (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    competitor_name text NOT NULL,
    developer_name text NOT NULL,
    micro_location text,
    status public.competitor_status DEFAULT 'launched'::public.competitor_status,
    launch_date text,
    handover_date text,
    total_units integer,
    unit_mix_studio_pct integer DEFAULT 0,
    unit_mix_1br_pct integer DEFAULT 0,
    unit_mix_2br_pct integer DEFAULT 0,
    unit_mix_3br_pct integer DEFAULT 0,
    avg_unit_size_sqm numeric(10,2),
    avg_price_psf numeric(10,2),
    price_range_low numeric(10,2),
    price_range_high numeric(10,2),
    payment_plan_summary text,
    incentives_summary text,
    sales_velocity integer,
    evidence_files text,
    source_system text,
    confidence_grade_comp public.confidence_grade DEFAULT 'B'::public.confidence_grade,
    last_verified_date text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: competitor_projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.competitor_projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: competitor_projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.competitor_projects_id_seq OWNED BY public.competitor_projects.id;


--
-- Name: conflict_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conflict_records (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    kpi_name text NOT NULL,
    source_a_id integer,
    source_b_id integer,
    source_a_value text NOT NULL,
    source_b_value text NOT NULL,
    delta_pct numeric(8,2),
    resolved_value text,
    resolution public.conflict_status DEFAULT 'unresolved'::public.conflict_status NOT NULL,
    rationale text,
    confidence public.confidence_level,
    confidence_score integer,
    resolved_by text,
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: conflict_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conflict_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conflict_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conflict_records_id_seq OWNED BY public.conflict_records.id;


--
-- Name: construction_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_milestones (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_id character varying NOT NULL,
    milestone_name text NOT NULL,
    target_percentage numeric(5,2) NOT NULL,
    consultant_certificate_attached boolean DEFAULT false NOT NULL,
    approved_release_amount numeric(16,2) DEFAULT '0'::numeric NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: consultant_financials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consultant_financials (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    consultant_id integer NOT NULL,
    design_type text DEFAULT 'pct'::text,
    design_value numeric(12,2) DEFAULT '0'::numeric,
    supervision_type text DEFAULT 'pct'::text,
    supervision_value numeric(12,2) DEFAULT '0'::numeric,
    proposal_link text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: consultant_financials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.consultant_financials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: consultant_financials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.consultant_financials_id_seq OWNED BY public.consultant_financials.id;


--
-- Name: consultants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consultants (
    id integer NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    specialization text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: consultants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.consultants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: consultants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.consultants_id_seq OWNED BY public.consultants.id;


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    contractor_name text NOT NULL,
    contractor_name_ar text,
    contract_type text NOT NULL,
    contract_value integer NOT NULL,
    retention_percent numeric(5,2) DEFAULT '10'::numeric,
    performance_bond_percent numeric(5,2) DEFAULT '10'::numeric,
    ld_terms text,
    start_date text,
    end_date text,
    status public.contract_status DEFAULT 'DRAFT'::public.contract_status NOT NULL,
    awarded_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: contracts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contracts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contracts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contracts_id_seq OWNED BY public.contracts.id;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    title text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: draft_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_decisions (
    id integer NOT NULL,
    run_id integer,
    agent_id character varying NOT NULL,
    project_id character varying,
    proposal_id integer,
    decision_type text NOT NULL,
    title_en text NOT NULL,
    title_ar text NOT NULL,
    rationale text,
    recommended_action text NOT NULL,
    impact jsonb,
    status public.draft_decision_status DEFAULT 'draft'::public.draft_decision_status NOT NULL,
    decided_by text,
    decided_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: draft_decisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.draft_decisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: draft_decisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.draft_decisions_id_seq OWNED BY public.draft_decisions.id;


--
-- Name: evaluator_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluator_scores (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    consultant_id integer NOT NULL,
    evaluator_id text NOT NULL,
    criterion_id integer NOT NULL,
    score integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: evaluator_scores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evaluator_scores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evaluator_scores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evaluator_scores_id_seq OWNED BY public.evaluator_scores.id;


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_id character varying NOT NULL,
    category public.expense_category NOT NULL,
    description text NOT NULL,
    amount numeric(16,2) NOT NULL,
    consultant_certificate_approved boolean DEFAULT false,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: extraction_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extraction_fields (
    id integer NOT NULL,
    extraction_run_id integer NOT NULL,
    canonical_field text NOT NULL,
    extracted_value text NOT NULL,
    confidence real DEFAULT 0 NOT NULL,
    evidence_type text,
    evidence_page integer,
    evidence_cell text,
    evidence_snippet text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: extraction_fields_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.extraction_fields_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: extraction_fields_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.extraction_fields_id_seq OWNED BY public.extraction_fields.id;


--
-- Name: extraction_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extraction_runs (
    id integer NOT NULL,
    document_id integer NOT NULL,
    agent_run_id integer,
    classification public.doc_classification,
    classification_confidence real,
    raw_text text,
    detected_tables jsonb,
    page_count integer,
    status public.agent_run_status DEFAULT 'queued'::public.agent_run_status NOT NULL,
    error_message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone
);


--
-- Name: extraction_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.extraction_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: extraction_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.extraction_runs_id_seq OWNED BY public.extraction_runs.id;


--
-- Name: feasibility_studies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feasibility_studies (
    id integer NOT NULL,
    project_id character varying,
    project_name text NOT NULL,
    community text,
    plot_number text,
    project_description text,
    land_use text,
    plot_area integer,
    gfa_residential integer,
    gfa_retail integer,
    gfa_offices integer,
    total_gfa integer,
    saleable_residential_pct integer DEFAULT 90,
    saleable_retail_pct integer DEFAULT 99,
    saleable_offices_pct integer DEFAULT 90,
    number_of_units integer,
    land_price integer,
    agent_commission_land_pct integer DEFAULT 1,
    soil_investigation integer,
    authorities_fee integer,
    construction_cost_per_sqft integer,
    design_fee_pct integer DEFAULT 2,
    supervision_fee_pct integer DEFAULT 2,
    contingencies_pct integer DEFAULT 2,
    developer_fee_pct integer DEFAULT 5,
    agent_commission_sale_pct integer DEFAULT 5,
    marketing_pct integer DEFAULT 2,
    rera_offplan_fee integer DEFAULT 150000,
    rera_unit_fee integer DEFAULT 850,
    noc_fee integer DEFAULT 10000,
    escrow_fee integer DEFAULT 140000,
    residential_sale_price integer,
    retail_sale_price integer,
    offices_sale_price integer,
    profit_share_pct integer DEFAULT 15,
    scenario_name text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    report_executive_summary text,
    report_market_study text,
    report_location_analysis text,
    report_risk_analysis text,
    report_sensitivity_analysis text,
    report_legal_compliance text,
    report_recommendations text,
    report_status text DEFAULT 'draft'::text,
    report_competitive_analysis text,
    report_product_strategy text,
    report_pricing_strategy text,
    report_absorption_forecast text,
    report_cash_flow_projection text,
    report_jv_sensitivity text,
    report_risk_quant text,
    report_executive_brief text,
    report_exit_strategy text,
    report_board_summary text,
    report_development_cost text,
    saleable_residential integer,
    saleable_retail integer,
    estimated_construction_area integer,
    res_1br_pct integer DEFAULT 0,
    res_2br_pct integer DEFAULT 0,
    res_3br_pct integer DEFAULT 0,
    res_1br_avg_size integer DEFAULT 750,
    res_2br_avg_size integer DEFAULT 1100,
    res_3br_avg_size integer DEFAULT 1500,
    shop_small_pct integer DEFAULT 0,
    shop_medium_pct integer DEFAULT 0,
    shop_large_pct integer DEFAULT 0,
    shop_small_avg_size integer DEFAULT 300,
    shop_medium_avg_size integer DEFAULT 600,
    shop_large_avg_size integer DEFAULT 1200,
    finishes_quality text,
    pricing_scenarios text,
    approved_scenario integer,
    competitive_pricing_fields text,
    topography_survey integer DEFAULT 15000,
    bank_charges integer DEFAULT 25000,
    community_fee integer DEFAULT 50000,
    surveyor_fees integer DEFAULT 30000,
    rera_audit_reports integer DEFAULT 50000,
    rera_inspection_reports integer DEFAULT 50000
);


--
-- Name: feasibility_studies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feasibility_studies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feasibility_studies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feasibility_studies_id_seq OWNED BY public.feasibility_studies.id;


--
-- Name: governance_gates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.governance_gates (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    gate_code text NOT NULL,
    gate_name text NOT NULL,
    gate_name_ar text,
    status public.gate_status DEFAULT 'PENDING'::public.gate_status NOT NULL,
    required_conditions jsonb,
    evaluation_result jsonb,
    decided_by text,
    decided_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: governance_gates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.governance_gates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: governance_gates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.governance_gates_id_seq OWNED BY public.governance_gates.id;


--
-- Name: ipcs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ipcs (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    contract_id integer,
    ipc_number integer NOT NULL,
    period_from text,
    period_to text,
    gross_certified_value integer NOT NULL,
    retention_deduction integer DEFAULT 0 NOT NULL,
    advance_recovery integer DEFAULT 0,
    penalties integer DEFAULT 0,
    net_payable integer NOT NULL,
    physical_progress integer DEFAULT 0 NOT NULL,
    status public.ipc_status DEFAULT 'DRAFT'::public.ipc_status NOT NULL,
    approved_by text,
    approved_at timestamp without time zone,
    paid_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ipcs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ipcs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ipcs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ipcs_id_seq OWNED BY public.ipcs.id;


--
-- Name: knowledge_base; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base (
    id integer NOT NULL,
    domain public.knowledge_domain NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    keywords text,
    source text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_base_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knowledge_base_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knowledge_base_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knowledge_base_id_seq OWNED BY public.knowledge_base.id;


--
-- Name: layla_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.layla_conversations (
    id integer NOT NULL,
    user_id text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    intent text,
    project_id character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: layla_conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.layla_conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: layla_conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.layla_conversations_id_seq OWNED BY public.layla_conversations.id;


--
-- Name: leadership_directives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leadership_directives (
    id integer NOT NULL,
    project_id character varying,
    type public.directive_type NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    reply text,
    replied_at timestamp without time zone,
    status text DEFAULT 'open'::text NOT NULL,
    created_by text DEFAULT 'ceo'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: leadership_directives_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leadership_directives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leadership_directives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leadership_directives_id_seq OWNED BY public.leadership_directives.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: payment_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_plans (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    plan_name text NOT NULL,
    plan_name_ar text,
    total_amount integer NOT NULL,
    installments jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_plans_id_seq OWNED BY public.payment_plans.id;


--
-- Name: portfolio_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portfolio_metrics (
    id integer NOT NULL,
    total_free_equity integer DEFAULT 0 NOT NULL,
    total_committed integer DEFAULT 0 NOT NULL,
    total_escrow_locked integer DEFAULT 0 NOT NULL,
    total_burned integer DEFAULT 0 NOT NULL,
    total_retention integer DEFAULT 0 NOT NULL,
    portfolio_exposure_ratio numeric(6,3),
    liquidity_runway_months numeric(6,1),
    project_count integer DEFAULT 0,
    computed_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: portfolio_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.portfolio_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: portfolio_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.portfolio_metrics_id_seq OWNED BY public.portfolio_metrics.id;


--
-- Name: project_assumptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_assumptions (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    units text,
    previous_value text,
    owner_approved boolean DEFAULT false NOT NULL,
    approved_by text,
    approved_at timestamp without time zone,
    rationale text,
    source_id integer,
    joelle_suggested boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: project_assumptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_assumptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_assumptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_assumptions_id_seq OWNED BY public.project_assumptions.id;


--
-- Name: project_budget_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_budget_items (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    category public.budget_category NOT NULL,
    item_key text NOT NULL,
    label_en text NOT NULL,
    label_ar text NOT NULL,
    amount numeric(16,2) DEFAULT '0'::numeric NOT NULL,
    percentage numeric(6,2),
    percentage_base text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_auto_calculated boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: project_budget_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_budget_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_budget_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_budget_items_id_seq OWNED BY public.project_budget_items.id;


--
-- Name: project_cash_flows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_cash_flows (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    month text NOT NULL,
    type public.cash_flow_type NOT NULL,
    source public.cash_flow_source NOT NULL,
    amount numeric(16,2) DEFAULT '0'::numeric NOT NULL,
    description text,
    category text,
    linked_activity_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: project_cash_flows_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_cash_flows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_cash_flows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_cash_flows_id_seq OWNED BY public.project_cash_flows.id;


--
-- Name: project_consultants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_consultants (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    consultant_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: project_consultants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_consultants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_consultants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_consultants_id_seq OWNED BY public.project_consultants.id;


--
-- Name: project_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_documents (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    filename text NOT NULL,
    original_name text NOT NULL,
    mime_type text,
    file_size integer,
    document_type public.document_type DEFAULT 'other'::public.document_type NOT NULL,
    source_system text,
    dataset_type public.dataset_type,
    checksum text,
    uploaded_by text DEFAULT 'owner'::text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    stage_item_id integer
);


--
-- Name: project_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_documents_id_seq OWNED BY public.project_documents.id;


--
-- Name: project_financials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_financials (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    total_project_cost numeric(16,2) DEFAULT '0'::numeric NOT NULL,
    equity_required numeric(16,2) DEFAULT '0'::numeric NOT NULL,
    bank_finance numeric(16,2) DEFAULT '0'::numeric NOT NULL,
    sales_target numeric(16,2) DEFAULT '0'::numeric NOT NULL,
    project_duration_months integer DEFAULT 30,
    sales_delay_months integer DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: project_financials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_financials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_financials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_financials_id_seq OWNED BY public.project_financials.id;


--
-- Name: project_scenarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_scenarios (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    feasibility_study_id integer,
    scenario_type public.scenario_type DEFAULT 'base'::public.scenario_type NOT NULL,
    name text NOT NULL,
    construction_cost_adj numeric(8,2) DEFAULT '0'::numeric,
    sale_price_adj numeric(8,2) DEFAULT '0'::numeric,
    absorption_adj numeric(8,2) DEFAULT '0'::numeric,
    gdv numeric(16,2),
    tdc numeric(16,2),
    net_profit numeric(16,2),
    roi numeric(8,2),
    irr numeric(8,2),
    equity_irr numeric(8,2),
    peak_cash_need numeric(16,2),
    funding_gap numeric(16,2),
    sales_duration_months integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: project_scenarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_scenarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_scenarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_scenarios_id_seq OWNED BY public.project_scenarios.id;


--
-- Name: project_state_transitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_state_transitions (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    from_state public.lifecycle_state,
    to_state public.lifecycle_state NOT NULL,
    triggered_by text DEFAULT 'system'::text,
    reason text,
    gates_passed text[],
    capital_snapshot jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: project_state_transitions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_state_transitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_state_transitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_state_transitions_id_seq OWNED BY public.project_state_transitions.id;


--
-- Name: project_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_tasks (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_id character varying NOT NULL,
    phase public.task_phase NOT NULL,
    task_name text NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    amount_aed numeric(16,2) DEFAULT '0'::numeric NOT NULL,
    wallet_source public.wallet_type NOT NULL,
    is_revenue boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    location text NOT NULL,
    total_gfa numeric(14,2) NOT NULL,
    sellable_area numeric(14,2) NOT NULL,
    construction_cost_per_sqft numeric(10,2) NOT NULL,
    status public.project_status DEFAULT 'Pre-study'::public.project_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    retained_5_percent_fund numeric(16,2) DEFAULT '0'::numeric,
    retention_release_date timestamp without time zone,
    completed_at timestamp without time zone,
    approved_sale_price_per_sqft numeric(10,2),
    title_deed_number text,
    dda_number text,
    master_dev_ref text,
    plot_area_sqm numeric(12,2),
    plot_area_sqft numeric(12,2),
    permitted_use text,
    ownership_type text,
    master_dev_name text,
    seller_name text,
    buyer_name text,
    buyer_nationality text,
    buyer_phone text,
    buyer_email text,
    electricity_allocation text,
    water_allocation text,
    sewage_allocation text,
    effective_date text,
    construction_period text,
    governing_law text,
    notes text,
    plot_number text,
    area_code text,
    gfa_sqm numeric(12,2),
    gfa_sqft numeric(12,2),
    subdivision_restrictions text,
    master_dev_address text,
    seller_address text,
    buyer_passport text,
    buyer_address text,
    trip_am text,
    trip_lt text,
    trip_pm text,
    construction_start_date text,
    completion_date text,
    construction_conditions text,
    sale_restrictions text,
    resale_conditions text,
    community_charges text,
    registration_authority text,
    admin_fee integer,
    clearance_fee integer,
    compensation_amount integer,
    dispute_resolution text,
    bua_sqft numeric(12,2),
    sellable_area_residential numeric(14,2),
    sellable_area_retail numeric(14,2),
    sellable_area_offices numeric(14,2),
    units_residential integer,
    units_retail integer,
    units_offices integer,
    land_price numeric(16,2),
    agent_commission_land_pct numeric(5,2)
);


--
-- Name: proposal_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposal_items (
    id integer NOT NULL,
    proposal_id integer NOT NULL,
    target_table text NOT NULL,
    target_id text,
    field_name text NOT NULL,
    old_value text,
    new_value text NOT NULL,
    confidence real DEFAULT 0 NOT NULL,
    evidence_type text,
    evidence_ref text,
    evidence_page integer,
    evidence_snippet text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: proposal_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.proposal_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: proposal_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.proposal_items_id_seq OWNED BY public.proposal_items.id;


--
-- Name: recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendations (
    id integer NOT NULL,
    run_id integer,
    agent_id character varying NOT NULL,
    project_id character varying,
    category text NOT NULL,
    title_en text NOT NULL,
    title_ar text NOT NULL,
    description_en text NOT NULL,
    description_ar text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    action_required boolean DEFAULT false NOT NULL,
    metadata jsonb,
    status public.proposal_status DEFAULT 'pending'::public.proposal_status NOT NULL,
    resolved_by text,
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: recommendations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recommendations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recommendations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recommendations_id_seq OWNED BY public.recommendations.id;


--
-- Name: reconciliation_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reconciliation_ledger (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    metric_id text NOT NULL,
    metric_name text NOT NULL,
    metric_definition text,
    geo_boundary_id text,
    window_start text,
    window_end text,
    source_a_name text NOT NULL,
    source_a_file text,
    source_a_value text NOT NULL,
    source_b_name text NOT NULL,
    source_b_file text,
    source_b_value text NOT NULL,
    variance_pct numeric(8,2),
    weights_applied text,
    decision_value text,
    confidence_grade public.confidence_grade DEFAULT 'B'::public.confidence_grade NOT NULL,
    exception_notes text,
    owners_approval_required boolean DEFAULT false,
    approved_by text,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: reconciliation_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reconciliation_ledger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reconciliation_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reconciliation_ledger_id_seq OWNED BY public.reconciliation_ledger.id;


--
-- Name: reconciliation_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reconciliation_proposals (
    id integer NOT NULL,
    run_id integer,
    agent_id character varying NOT NULL,
    project_id character varying,
    document_id integer,
    title_en text NOT NULL,
    title_ar text NOT NULL,
    description text,
    status public.proposal_status DEFAULT 'pending'::public.proposal_status NOT NULL,
    approved_by text,
    approved_at timestamp without time zone,
    rejection_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: reconciliation_proposals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reconciliation_proposals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reconciliation_proposals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reconciliation_proposals_id_seq OWNED BY public.reconciliation_proposals.id;


--
-- Name: regulatory_dependencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regulatory_dependencies (
    id integer NOT NULL,
    node_id integer NOT NULL,
    depends_on_node_id integer NOT NULL,
    dependency_type public.dependency_type DEFAULT 'REQUIRED'::public.dependency_type NOT NULL
);


--
-- Name: regulatory_dependencies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.regulatory_dependencies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: regulatory_dependencies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.regulatory_dependencies_id_seq OWNED BY public.regulatory_dependencies.id;


--
-- Name: regulatory_nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regulatory_nodes (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    node_type public.regulatory_node_type NOT NULL,
    status public.regulatory_status DEFAULT 'NOT_STARTED'::public.regulatory_status NOT NULL,
    document_ref text,
    notes text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by text
);


--
-- Name: regulatory_nodes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.regulatory_nodes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: regulatory_nodes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.regulatory_nodes_id_seq OWNED BY public.regulatory_nodes.id;


--
-- Name: report_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_versions (
    id integer NOT NULL,
    feasibility_study_id integer NOT NULL,
    project_id character varying,
    version_number text NOT NULL,
    version_status public.report_version_status DEFAULT 'draft'::public.report_version_status NOT NULL,
    gdv numeric(16,2),
    tdc numeric(16,2),
    net_profit numeric(16,2),
    profit_margin_pct numeric(8,2),
    project_irr numeric(8,2),
    equity_irr numeric(8,2),
    expected_sales_duration text,
    funding_gap numeric(16,2),
    risk_level public.risk_level DEFAULT 'yellow'::public.risk_level,
    recommendation public.board_recommendation,
    required_action text,
    report_snapshot text,
    technical_validation text,
    financial_validation text,
    legal_validation text,
    validated_by text,
    validated_at timestamp without time zone,
    issued_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: report_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.report_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: report_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.report_versions_id_seq OWNED BY public.report_versions.id;


--
-- Name: risk_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risk_scores (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    liquidity_risk numeric(6,3) DEFAULT '0'::numeric,
    sales_risk numeric(6,3) DEFAULT '0'::numeric,
    construction_risk numeric(6,3) DEFAULT '0'::numeric,
    regulatory_risk numeric(6,3) DEFAULT '0'::numeric,
    portfolio_risk numeric(6,3) DEFAULT '0'::numeric,
    total_risk numeric(6,3) DEFAULT '0'::numeric,
    lsr numeric(6,3),
    ecr numeric(6,3),
    risk_level_project public.project_risk_level DEFAULT 'LOW'::public.project_risk_level NOT NULL,
    signals jsonb,
    computed_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: risk_scores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.risk_scores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: risk_scores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.risk_scores_id_seq OWNED BY public.risk_scores.id;


--
-- Name: sales_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_units (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    unit_number text NOT NULL,
    unit_type text NOT NULL,
    floor integer DEFAULT 0,
    area numeric(10,2) NOT NULL,
    asking_price integer DEFAULT 0,
    unit_status public.unit_status DEFAULT 'AVAILABLE'::public.unit_status NOT NULL,
    buyer_name text,
    sale_price integer,
    sale_date text,
    oqood_registered boolean DEFAULT false,
    oqood_date text,
    payment_plan_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sales_units_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_units_id_seq OWNED BY public.sales_units.id;


--
-- Name: source_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.source_registry (
    id integer NOT NULL,
    name text NOT NULL,
    tier public.source_tier NOT NULL,
    access_method public.access_method DEFAULT 'manual_file'::public.access_method NOT NULL,
    url text,
    description text,
    fields_provided text[],
    refresh_cadence text,
    license_notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: source_registry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.source_registry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: source_registry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.source_registry_id_seq OWNED BY public.source_registry.id;


--
-- Name: stage_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stage_items (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    phase text NOT NULL,
    title text NOT NULL,
    title_ar text NOT NULL,
    href text,
    status text DEFAULT 'not_started'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    code text,
    description text,
    owner text,
    planned_start_date text,
    planned_end_date text,
    is_board_level boolean DEFAULT false NOT NULL,
    cash_outflow numeric(16,2) DEFAULT '0'::numeric NOT NULL,
    cash_inflow numeric(16,2) DEFAULT '0'::numeric NOT NULL,
    description_ar text,
    required_docs text,
    required_docs_ar text,
    notes text
);


--
-- Name: stage_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stage_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stage_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stage_items_id_seq OWNED BY public.stage_items.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    wallet_id character varying NOT NULL,
    project_id character varying NOT NULL,
    amount numeric(16,2) NOT NULL,
    description text NOT NULL,
    type text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: variation_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variation_orders (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    contract_id integer,
    vo_number text NOT NULL,
    vo_type public.vo_type NOT NULL,
    title text NOT NULL,
    title_ar text,
    description text,
    estimated_cost integer DEFAULT 0,
    approved_cost integer,
    status public.vo_status DEFAULT 'DRAFT'::public.vo_status NOT NULL,
    impact_on_tcc integer DEFAULT 0,
    impact_on_schedule_days integer DEFAULT 0,
    cumulative_vo_percent numeric(6,3),
    approved_by text,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: variation_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.variation_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: variation_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.variation_orders_id_seq OWNED BY public.variation_orders.id;


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallets (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_id character varying NOT NULL,
    type public.wallet_type NOT NULL,
    label text NOT NULL,
    balance numeric(16,2) DEFAULT '0'::numeric NOT NULL
);


--
-- Name: wbs_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wbs_items (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    level integer NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    description text,
    parent_id integer,
    sort_order integer DEFAULT 0 NOT NULL,
    owner text,
    start_date text,
    end_date text,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: wbs_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wbs_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wbs_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wbs_items_id_seq OWNED BY public.wbs_items.id;


--
-- Name: agent_outputs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_outputs ALTER COLUMN id SET DEFAULT nextval('public.agent_outputs_id_seq'::regclass);


--
-- Name: agent_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_runs ALTER COLUMN id SET DEFAULT nextval('public.agent_runs_id_seq'::regclass);


--
-- Name: agent_tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tasks ALTER COLUMN id SET DEFAULT nextval('public.agent_tasks_id_seq'::regclass);


--
-- Name: ai_advisory_scores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_advisory_scores ALTER COLUMN id SET DEFAULT nextval('public.ai_advisory_scores_id_seq'::regclass);


--
-- Name: alerts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts ALTER COLUMN id SET DEFAULT nextval('public.alerts_id_seq'::regclass);


--
-- Name: approval_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests ALTER COLUMN id SET DEFAULT nextval('public.approval_requests_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: board_decision_view id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_decision_view ALTER COLUMN id SET DEFAULT nextval('public.board_decision_view_id_seq'::regclass);


--
-- Name: board_portfolio_cache id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_portfolio_cache ALTER COLUMN id SET DEFAULT nextval('public.board_portfolio_cache_id_seq'::regclass);


--
-- Name: board_project_cache id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_project_cache ALTER COLUMN id SET DEFAULT nextval('public.board_project_cache_id_seq'::regclass);


--
-- Name: capital_balances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_balances ALTER COLUMN id SET DEFAULT nextval('public.capital_balances_id_seq'::regclass);


--
-- Name: capital_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_events ALTER COLUMN id SET DEFAULT nextval('public.capital_events_id_seq'::regclass);


--
-- Name: chat_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_history ALTER COLUMN id SET DEFAULT nextval('public.chat_history_id_seq'::regclass);


--
-- Name: command_center_inquiries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.command_center_inquiries ALTER COLUMN id SET DEFAULT nextval('public.command_center_inquiries_id_seq'::regclass);


--
-- Name: committee_decisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.committee_decisions ALTER COLUMN id SET DEFAULT nextval('public.committee_decisions_id_seq'::regclass);


--
-- Name: competitor_projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_projects ALTER COLUMN id SET DEFAULT nextval('public.competitor_projects_id_seq'::regclass);


--
-- Name: conflict_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conflict_records ALTER COLUMN id SET DEFAULT nextval('public.conflict_records_id_seq'::regclass);


--
-- Name: consultant_financials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultant_financials ALTER COLUMN id SET DEFAULT nextval('public.consultant_financials_id_seq'::regclass);


--
-- Name: consultants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultants ALTER COLUMN id SET DEFAULT nextval('public.consultants_id_seq'::regclass);


--
-- Name: contracts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts ALTER COLUMN id SET DEFAULT nextval('public.contracts_id_seq'::regclass);


--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Name: draft_decisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_decisions ALTER COLUMN id SET DEFAULT nextval('public.draft_decisions_id_seq'::regclass);


--
-- Name: evaluator_scores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluator_scores ALTER COLUMN id SET DEFAULT nextval('public.evaluator_scores_id_seq'::regclass);


--
-- Name: extraction_fields id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction_fields ALTER COLUMN id SET DEFAULT nextval('public.extraction_fields_id_seq'::regclass);


--
-- Name: extraction_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction_runs ALTER COLUMN id SET DEFAULT nextval('public.extraction_runs_id_seq'::regclass);


--
-- Name: feasibility_studies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feasibility_studies ALTER COLUMN id SET DEFAULT nextval('public.feasibility_studies_id_seq'::regclass);


--
-- Name: governance_gates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_gates ALTER COLUMN id SET DEFAULT nextval('public.governance_gates_id_seq'::regclass);


--
-- Name: ipcs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipcs ALTER COLUMN id SET DEFAULT nextval('public.ipcs_id_seq'::regclass);


--
-- Name: knowledge_base id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base ALTER COLUMN id SET DEFAULT nextval('public.knowledge_base_id_seq'::regclass);


--
-- Name: layla_conversations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layla_conversations ALTER COLUMN id SET DEFAULT nextval('public.layla_conversations_id_seq'::regclass);


--
-- Name: leadership_directives id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leadership_directives ALTER COLUMN id SET DEFAULT nextval('public.leadership_directives_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: payment_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans ALTER COLUMN id SET DEFAULT nextval('public.payment_plans_id_seq'::regclass);


--
-- Name: portfolio_metrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_metrics ALTER COLUMN id SET DEFAULT nextval('public.portfolio_metrics_id_seq'::regclass);


--
-- Name: project_assumptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assumptions ALTER COLUMN id SET DEFAULT nextval('public.project_assumptions_id_seq'::regclass);


--
-- Name: project_budget_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_budget_items ALTER COLUMN id SET DEFAULT nextval('public.project_budget_items_id_seq'::regclass);


--
-- Name: project_cash_flows id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_cash_flows ALTER COLUMN id SET DEFAULT nextval('public.project_cash_flows_id_seq'::regclass);


--
-- Name: project_consultants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_consultants ALTER COLUMN id SET DEFAULT nextval('public.project_consultants_id_seq'::regclass);


--
-- Name: project_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_documents ALTER COLUMN id SET DEFAULT nextval('public.project_documents_id_seq'::regclass);


--
-- Name: project_financials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_financials ALTER COLUMN id SET DEFAULT nextval('public.project_financials_id_seq'::regclass);


--
-- Name: project_scenarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_scenarios ALTER COLUMN id SET DEFAULT nextval('public.project_scenarios_id_seq'::regclass);


--
-- Name: project_state_transitions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_state_transitions ALTER COLUMN id SET DEFAULT nextval('public.project_state_transitions_id_seq'::regclass);


--
-- Name: proposal_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_items ALTER COLUMN id SET DEFAULT nextval('public.proposal_items_id_seq'::regclass);


--
-- Name: recommendations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendations ALTER COLUMN id SET DEFAULT nextval('public.recommendations_id_seq'::regclass);


--
-- Name: reconciliation_ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_ledger ALTER COLUMN id SET DEFAULT nextval('public.reconciliation_ledger_id_seq'::regclass);


--
-- Name: reconciliation_proposals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_proposals ALTER COLUMN id SET DEFAULT nextval('public.reconciliation_proposals_id_seq'::regclass);


--
-- Name: regulatory_dependencies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_dependencies ALTER COLUMN id SET DEFAULT nextval('public.regulatory_dependencies_id_seq'::regclass);


--
-- Name: regulatory_nodes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_nodes ALTER COLUMN id SET DEFAULT nextval('public.regulatory_nodes_id_seq'::regclass);


--
-- Name: report_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_versions ALTER COLUMN id SET DEFAULT nextval('public.report_versions_id_seq'::regclass);


--
-- Name: risk_scores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_scores ALTER COLUMN id SET DEFAULT nextval('public.risk_scores_id_seq'::regclass);


--
-- Name: sales_units id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_units ALTER COLUMN id SET DEFAULT nextval('public.sales_units_id_seq'::regclass);


--
-- Name: source_registry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_registry ALTER COLUMN id SET DEFAULT nextval('public.source_registry_id_seq'::regclass);


--
-- Name: stage_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stage_items ALTER COLUMN id SET DEFAULT nextval('public.stage_items_id_seq'::regclass);


--
-- Name: variation_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variation_orders ALTER COLUMN id SET DEFAULT nextval('public.variation_orders_id_seq'::regclass);


--
-- Name: wbs_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_items ALTER COLUMN id SET DEFAULT nextval('public.wbs_items_id_seq'::regclass);


--
-- Data for Name: agent_outputs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.agent_outputs (id, run_id, agent_id, output_type, output_data, summary, created_at) FROM stdin;
\.


--
-- Data for Name: agent_runs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.agent_runs (id, agent_id, project_id, trigger, trigger_ref, status, input_context, duration_ms, error_message, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: agent_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.agent_tasks (id, from_agent_id, to_agent_id, project_id, task_type, title, payload, result, status, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: ai_advisory_scores; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_advisory_scores (id, project_id, consultant_id, criterion_id, suggested_score, reasoning, created_at) FROM stdin;
\.


--
-- Data for Name: ai_agents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_agents (id, name_en, name_ar, role_en, role_ar, description_en, description_ar, avatar_url, avatar_color, avatar_initial, system_prompt, tool_ids, capabilities, status, sort_order, created_at) FROM stdin;
salwa	Salwa	سلوى	Executive Coordinator & AI Director	المنسقة التنفيذية ومديرة الذكاء الاصطناعي	Salwa is the central coordinator of the AURA system. She receives all requests, delegates tasks to specialist agents, and ensures quality delivery. She is your single point of contact.	سلوى هي المنسقة الرئيسية لنظام أورا. تستقبل جميع الطلبات وتوزع المهام على الوكلاء المتخصصين وتضمن جودة التسليم. هي نقطة الاتصال الوحيدة لك.	\N	#F59E0B	S	\N	{list_projects,get_project_detail,get_dashboard_summary,search_knowledge_base}	{email_triage,task_delegation,client_communication,workflow_orchestration,project_overview}	active	0	2026-02-27 11:27:44.045453
khazen	Khazen	خازن	Archive & Storage Manager	مدير الأرشفة والتخزين	Khazen manages all project documents, files, and data. He handles document parsing, data extraction, file classification, and archival naming conventions. He populates project fact sheets from source documents.	خازن يدير جميع وثائق ومستندات وبيانات المشاريع. يتولى تحليل المستندات واستخراج البيانات وتصنيف الملفات وتسميات الأرشفة. يملأ بطاقات بيانات المشاريع من الوثائق المصدرية.	\N	#10B981	خ	\N	{get_project_detail,list_projects}	{document_parsing,file_classification,data_extraction,project_creation,archival_naming}	active	1	2026-02-27 11:27:44.053886
joelle	Joelle	جويل	Feasibility Studies & Market Analyst	محللة دراسات الجدوى والسوق	Joelle specializes in feasibility studies, market analysis, financial projections, and scenario building. She researches market data, sale prices, construction costs, and generates comprehensive feasibility reports.	جويل متخصصة في دراسات الجدوى وتحليل السوق والتوقعات المالية وبناء السيناريوهات. تبحث في بيانات السوق وأسعار البيع وتكاليف البناء وتنتج تقارير جدوى شاملة.	\N	#8B5CF6	J	\N	{get_project_detail,get_feasibility_studies,get_sensitivity_analysis,search_knowledge_base}	{feasibility_modeling,financial_projections,market_analysis,scenario_building,report_generation}	active	2	2026-02-27 11:27:44.058502
farouq	Farouq	فاروق	Legal Expert — Contracts & Law	محامي خبير - العقود والقانون	Farouq is the legal expert handling contract analysis, risk identification, RERA compliance, amendment drafting, and legal research. He ensures all projects comply with UAE Federal Law and Dubai Land Department regulations.	فاروق هو الخبير القانوني المسؤول عن تحليل العقود وتحديد المخاطر والامتثال لقوانين ريرا وصياغة التعديلات والبحث القانوني. يضمن التزام جميع المشاريع بالقانون الاتحادي ولوائح دائرة الأراضي.	\N	#F97316	F	\N	{search_knowledge_base,get_rera_status,calculate_buyer_default}	{contract_analysis,risk_identification,rera_compliance,amendment_drafting,legal_research}	active	3	2026-02-27 11:27:44.061795
alina	Alina	ألينا	CFO & Cost Control Director	المديرة المالية ومراقبة التكاليف	Alina is the Chief Financial Officer responsible for financial reporting, cash flow analysis, scenario modeling, investor presentations, and budget tracking across all projects.	ألينا هي المديرة المالية المسؤولة عن التقارير المالية وتحليل التدفقات النقدية ونمذجة السيناريوهات وعروض المستثمرين ومتابعة الميزانيات لجميع المشاريع.	\N	#EC4899	A	\N	{get_wallet_balances,get_dashboard_summary,get_sensitivity_analysis,get_feasibility_studies}	{financial_reporting,cashflow_analysis,scenario_modeling,investor_presentation,budget_tracking}	active	4	2026-02-27 13:49:25.958436
khaled	Khaled	خالد	Quality Assurance & Technical Compliance Auditor	مدقق الجودة والامتثال الفني	Khaled ensures all project deliverables meet quality standards and technical compliance requirements. He audits consultant work, reviews engineering specifications, and validates construction quality benchmarks.	خالد يضمن أن جميع مخرجات المشاريع تستوفي معايير الجودة ومتطلبات الامتثال الفني. يدقق أعمال الاستشاريين ويراجع المواصفات الهندسية ويتحقق من معايير جودة البناء.	\N	#06B6D4	خ	\N	{get_project_detail,list_projects}	{quality_audit,technical_review,compliance_check,specification_validation,consultant_evaluation}	active	5	2026-02-27 13:49:25.964831
buraq	Buraq	براق	Execution Monitor & Schedule Controller	مراقب التنفيذ والجدول الزمني	Buraq monitors project execution progress, tracks construction schedules, manages milestones, and alerts on delays. He keeps the WBS and development stages on track.	براق يراقب تقدم تنفيذ المشاريع ويتابع جداول البناء ويدير المراحل الرئيسية وينبّه على التأخيرات. يحافظ على برنامج العمل ومراحل التطوير في مسارها.	\N	#EF4444	B	\N	{get_project_detail,list_projects}	{schedule_monitoring,milestone_tracking,delay_alerting,wbs_management,progress_reporting}	active	6	2026-02-27 13:49:26.098471
baz	Baz	باز	Strategic Innovation & Optimization Advisor	المستشار الاستراتيجي للابتكار والتحسين	Baz provides strategic insights for innovation and optimization across projects. He identifies opportunities for value engineering, cost reduction, and process improvement.	باز يقدم رؤى استراتيجية للابتكار والتحسين عبر المشاريع. يحدد فرص هندسة القيمة وخفض التكاليف وتحسين العمليات.	\N	#6366F1	ب	\N	{get_dashboard_summary,get_feasibility_studies,search_knowledge_base}	{strategic_analysis,value_engineering,cost_optimization,process_improvement,innovation_research}	active	7	2026-02-27 13:49:26.102855
\.


--
-- Data for Name: ai_market_data; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_market_data (id, project_id, data_type, value, previous_value, unit, source, insight, impact_description, status, created_at) FROM stdin;
\.


--
-- Data for Name: alerts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alerts (id, run_id, agent_id, project_id, severity, title_en, title_ar, message_en, message_ar, metric, current_value, threshold, acknowledged, acknowledged_by, acknowledged_at, created_at) FROM stdin;
\.


--
-- Data for Name: approval_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.approval_requests (id, project_id, type, title, title_ar, description, recommendation, status, response_note, responded_by, responded_at, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_log (id, project_id, action, entity_type, entity_id, previous_value, new_value, performed_by, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: board_decision_view; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.board_decision_view (id, project_id, decision_type, title, title_ar, summary, summary_ar, recommendation, status, decided_by, decided_at, created_at) FROM stdin;
\.


--
-- Data for Name: board_portfolio_cache; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.board_portfolio_cache (id, total_projects, total_gdv, total_tdc, avg_roi, portfolio_health_grade, c1_total, c2_total, c3_total, c4_total, c5_total, risk_summary, updated_at) FROM stdin;
\.


--
-- Data for Name: board_project_cache; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.board_project_cache (id, project_id, project_name, project_name_ar, location, status, gdv, tdc, roi, risk_level, physical_progress, sales_progress, capital_state, executive_summary, executive_summary_ar, updated_at) FROM stdin;
\.


--
-- Data for Name: capital_balances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.capital_balances (id, project_id, c1_free_equity, c2_committed_equity, c3_escrow_locked, c4_deployed_burn, c5_retention_held, liquidity_real, updated_at) FROM stdin;
10	905c5323-dcbd-4eeb-b944-acd6d4f6a037	1189294	165000	8428096	28969917	163289	9454101	2026-03-02 00:37:06.724053
\.


--
-- Data for Name: capital_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.capital_events (id, project_id, event_type, amount, from_state, to_state, description, reference_id, reference_type, created_by, created_at) FROM stdin;
87	905c5323-dcbd-4eeb-b944-acd6d4f6a037	ESCROW_DEPOSIT	7885596	\N	\N	إيداع 20% من تكلفة البناء في حساب الضمان	\N	\N	system	2025-05-01 00:00:00
88	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	18000000	\N	\N	Land Cost — سداد قيمة الأرض	\N	\N	system	2025-05-01 00:00:00
89	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	720000	\N	\N	Land Registration Fee 4%	\N	\N	system	2025-05-05 00:00:00
90	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	1943780	\N	\N	Developer Fixed Fee المرحلة الأولى 2%	\N	\N	system	2025-05-10 00:00:00
91	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	25000	\N	\N	Soil Investigation Report Charges	\N	\N	system	2025-05-20 00:00:00
92	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	8000	\N	\N	Topography Survey Works	\N	\N	system	2025-05-22 00:00:00
93	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	788560	\N	\N	Project Design Fee 2.00%	\N	\N	system	2025-06-15 00:00:00
94	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	150000	\N	\N	Project off plan registration - RERA fees	\N	\N	system	2025-07-01 00:00:00
95	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	39100	\N	\N	Project unit registration fees - RERA fees	\N	\N	system	2025-07-01 00:00:00
96	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	10000	\N	\N	NOC to sell_Developer fees	\N	\N	system	2025-07-15 00:00:00
97	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	140000	\N	\N	Escrow bank account fees	\N	\N	system	2025-05-01 00:00:00
98	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	20000	\N	\N	Bank Charges	\N	\N	system	2025-05-01 00:00:00
99	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	971890	\N	\N	Marketing & Advertisement 1% — المرحلة الأولى	\N	\N	system	2025-08-01 00:00:00
102	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	12000	\N	\N	Surveyor fees (to confirm sqft)	\N	\N	system	2025-11-01 00:00:00
103	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	16000	\N	\N	Community Fee	\N	\N	system	2025-11-01 00:00:00
104	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	153332	\N	\N	Project Supervision Fee 1.75% — 4 أشهر من 18	\N	\N	system	2026-02-28 00:00:00
105	905c5323-dcbd-4eeb-b944-acd6d4f6a037	ESCROW_RELEASE	1710000	\N	\N	صرف IPC #1 من حساب الضمان	\N	\N	system	2025-12-15 00:00:00
106	905c5323-dcbd-4eeb-b944-acd6d4f6a037	ESCROW_RELEASE	1392500	\N	\N	صرف IPC #2 من حساب الضمان	\N	\N	system	2026-01-15 00:00:00
107	905c5323-dcbd-4eeb-b944-acd6d4f6a037	RETENTION_HOLD	90000	\N	\N	حجز ضمان IPC #1 (5%)	\N	\N	system	2025-12-15 00:00:00
108	905c5323-dcbd-4eeb-b944-acd6d4f6a037	RETENTION_HOLD	73289	\N	\N	حجز ضمان IPC #2 (5%)	\N	\N	system	2026-01-15 00:00:00
109	905c5323-dcbd-4eeb-b944-acd6d4f6a037	SALES_RECEIPT	1518750	\N	\N	حجوزات 5 وحدات — دفعة 15%	\N	\N	system	2025-12-01 00:00:00
110	905c5323-dcbd-4eeb-b944-acd6d4f6a037	SALES_RECEIPT	1518750	\N	\N	حجوزات 5 وحدات — دفعة 15%	\N	\N	system	2026-01-10 00:00:00
100	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	1000000	\N	\N	Authorities Fee	\N	\N	system	2025-09-01 00:00:00
101	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BURN_PAYMENT	2033044	\N	\N	Separation Fee — 40 AED x GFA area	\N	\N	system	2025-09-10 00:00:00
111	905c5323-dcbd-4eeb-b944-acd6d4f6a037	SALES_RECEIPT	607500	\N	\N	أقساط بناء — 3 وحدات مبكرة	\N	\N	system	2026-02-15 00:00:00
112	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VO_COST	165000	\N	\N	VO-001 أعمال خوازيق إضافية	\N	\N	system	2026-02-01 00:00:00
113	905c5323-dcbd-4eeb-b944-acd6d4f6a037	EQUITY_INJECT	18720000	\N	\N	ضخ رأس مال — شراء الأرض + رسم التسجيل (Paid Funds)	\N	\N	system	2025-04-15 00:00:00
114	905c5323-dcbd-4eeb-b944-acd6d4f6a037	EQUITY_INJECT	7885596	\N	\N	ضخ رأس مال — إيداع RERA 20% من تكلفة البناء	\N	\N	system	2025-05-01 00:00:00
115	905c5323-dcbd-4eeb-b944-acd6d4f6a037	EQUITY_INJECT	5000000	\N	\N	ضخ رأس مال — تغطية مصاريف المرحلة الأولى	\N	\N	system	2025-05-15 00:00:00
116	905c5323-dcbd-4eeb-b944-acd6d4f6a037	EQUITY_INJECT	3500000	\N	\N	ضخ رأس مال — دفعة تشغيلية المرحلة الثانية	\N	\N	system	2025-12-15 00:00:00
\.


--
-- Data for Name: chat_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_history (id, agent, role, content, created_at) FROM stdin;
\.


--
-- Data for Name: command_center_inquiries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.command_center_inquiries (id, project_id, sender_role, sender_name, message, response, responded_by, status, escalated_to_owner, created_at, responded_at) FROM stdin;
\.


--
-- Data for Name: committee_decisions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.committee_decisions (id, project_id, selected_consultant_id, decision_type, decision_basis, justification, negotiation_target, negotiation_conditions, committee_notes, ai_analysis, ai_recommendation, ai_post_decision_analysis, is_confirmed, confirmed_at, confirmed_by, created_at) FROM stdin;
\.


--
-- Data for Name: competitor_projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.competitor_projects (id, project_id, competitor_name, developer_name, micro_location, status, launch_date, handover_date, total_units, unit_mix_studio_pct, unit_mix_1br_pct, unit_mix_2br_pct, unit_mix_3br_pct, avg_unit_size_sqm, avg_price_psf, price_range_low, price_range_high, payment_plan_summary, incentives_summary, sales_velocity, evidence_files, source_system, confidence_grade_comp, last_verified_date, created_at) FROM stdin;
\.


--
-- Data for Name: conflict_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.conflict_records (id, project_id, kpi_name, source_a_id, source_b_id, source_a_value, source_b_value, delta_pct, resolved_value, resolution, rationale, confidence, confidence_score, resolved_by, resolved_at, created_at) FROM stdin;
\.


--
-- Data for Name: construction_milestones; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.construction_milestones (id, project_id, milestone_name, target_percentage, consultant_certificate_attached, approved_release_amount, status, completed_at, created_at) FROM stdin;
4f757cb5-ec56-434d-bf61-d7a295bd7282	905c5323-dcbd-4eeb-b944-acd6d4f6a037	إنجاز الأساسات	30.00	f	5900000.00	pending	\N	2026-03-01 22:51:16.306265
89d12180-9aee-4b50-80e0-f344ec7416c5	905c5323-dcbd-4eeb-b944-acd6d4f6a037	إنجاز الهيكل الإنشائي	50.00	f	11800000.00	pending	\N	2026-03-01 22:51:16.346773
f1bbaa2d-10f8-4f1e-9ca8-8b1b0baab5ee	905c5323-dcbd-4eeb-b944-acd6d4f6a037	أعمال التشطيبات الداخلية	70.00	f	11800000.00	pending	\N	2026-03-01 22:51:16.387937
ae8279a3-c3d0-40d7-ab41-ec2846eb0d86	905c5323-dcbd-4eeb-b944-acd6d4f6a037	أعمال MEP والتمديدات	85.00	f	8900000.00	pending	\N	2026-03-01 22:51:16.428943
97ff6986-60b4-477a-83c9-301a2d53e4cc	905c5323-dcbd-4eeb-b944-acd6d4f6a037	اكتمال البناء والتسليم	100.00	f	10433914.00	pending	\N	2026-03-01 22:51:16.468213
0a35bc09-c53d-4401-9261-641b3c1d9f1e	905c5323-dcbd-4eeb-b944-acd6d4f6a037	شراء الأرض وتسجيلها	0.00	f	18000000.00	approved	\N	2026-03-01 22:51:03.294455
2284dde4-ee3b-49ff-a999-5a1c0e784083	905c5323-dcbd-4eeb-b944-acd6d4f6a037	إنجاز التصاميم والموافقات	10.00	t	2600000.00	approved	2025-01-15 00:00:00	2026-03-01 22:51:16.065076
fff21eee-1ed0-4195-a210-5d1434f604c7	905c5323-dcbd-4eeb-b944-acd6d4f6a037	إصدار رخصة البناء	15.00	t	1200000.00	approved	2025-02-25 00:00:00	2026-03-01 22:51:16.22704
52b3cbc5-160d-4eac-ac91-a6c9ee8954c8	905c5323-dcbd-4eeb-b944-acd6d4f6a037	تكليف المقاول وبدء التنفيذ	20.00	t	4300000.00	approved	2025-03-01 00:00:00	2026-03-01 22:51:16.26692
\.


--
-- Data for Name: consultant_financials; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.consultant_financials (id, project_id, consultant_id, design_type, design_value, supervision_type, supervision_value, proposal_link, created_at) FROM stdin;
24	942123b5-a03e-4091-8395-8325ea1993b9	13	fixed	5350000.00	fixed	5350000.00	https://drive.google.com/file/d/1mRSctF9KBkBuwMA0H5juOxR11EsnqKHp/view	2026-03-02 15:00:30.253159
25	942123b5-a03e-4091-8395-8325ea1993b9	14	pct	1.80	pct	2.00	https://drive.google.com/file/d/1P3xXM8yJE5W3D4CN_nUxqaDymW4pwKEj/view	2026-03-02 15:00:30.258138
26	19e5e2bd-97bd-46fd-ae02-2926bca1ab0a	11	fixed	400000.00	fixed	35000.00	https://drive.google.com/file/d/13iHIObmTE8epvB4oW1IxVGcOs5kF4wx9/view	2026-03-02 15:00:30.262176
27	19e5e2bd-97bd-46fd-ae02-2926bca1ab0a	12	pct	1.50	pct	1.50	https://drive.google.com/file/d/1yJf0AaNnzRUXkFlN3D-yE8XReXqIKLBk/view	2026-03-02 15:00:30.267032
28	19e5e2bd-97bd-46fd-ae02-2926bca1ab0a	13	fixed	850000.00	fixed	850000.00	https://drive.google.com/file/d/15II8e1viJ3cTs5eZS73M8oHqih72abti/view	2026-03-02 15:00:30.27025
29	19e5e2bd-97bd-46fd-ae02-2926bca1ab0a	14	pct	2.00	pct	2.00	https://drive.google.com/file/d/1P3xXM8yJE5W3D4CN_nUxqaDymW4pwKEj/view	2026-03-02 15:00:30.274031
30	905c5323-dcbd-4eeb-b944-acd6d4f6a037	12	pct	1.50	pct	1.50	https://drive.google.com/file/d/146LlG-pNAG6oYdXVOelXm-zJ4Zn7DcdD/view	2026-03-02 15:00:30.277932
31	905c5323-dcbd-4eeb-b944-acd6d4f6a037	13	fixed	865000.00	fixed	865000.00	https://drive.google.com/file/d/1Q-GPEHK04QsSQlg9jBld9wQhem4w7-Rk/view	2026-03-02 15:00:30.281905
32	905c5323-dcbd-4eeb-b944-acd6d4f6a037	14	pct	2.00	pct	2.00	https://drive.google.com/file/d/1P3xXM8yJE5W3D4CN_nUxqaDymW4pwKEj/view	2026-03-02 15:00:30.285312
33	b06cf954-52bd-499e-b9ab-3640cd440dfb	12	pct	1.50	pct	1.50	https://drive.google.com/file/d/1lizn3-vU8O5RGHTiGjwqdw9yncdaimvf/view	2026-03-02 15:00:30.288739
34	b06cf954-52bd-499e-b9ab-3640cd440dfb	13	fixed	1550000.00	fixed	1550000.00	https://drive.google.com/file/d/1QE1zZ9RSIjmCmOuwvbO_gpA08rHbzPVA/view	2026-03-02 15:00:30.292151
35	b06cf954-52bd-499e-b9ab-3640cd440dfb	14	pct	2.00	pct	2.00	https://drive.google.com/file/d/1P3xXM8yJE5W3D4CN_nUxqaDymW4pwKEj/view	2026-03-02 15:00:30.295778
36	3c6c31c7-976b-4f23-9bd3-8fb57a9789a4	12	pct	1.50	pct	2.00	https://drive.google.com/file/d/1enw1J8RSHDT6vbCyxEhcaffTHpNDnBXX/view	2026-03-02 15:00:30.299116
37	3c6c31c7-976b-4f23-9bd3-8fb57a9789a4	13	fixed	272000.00	fixed	272000.00	https://drive.google.com/file/d/1kiRXKF_-zgtsW3Vxo2voYJEL1Uu6YtX9/view	2026-03-02 15:00:30.3027
38	3c6c31c7-976b-4f23-9bd3-8fb57a9789a4	14	pct	2.50	pct	2.00	https://drive.google.com/file/d/1P3xXM8yJE5W3D4CN_nUxqaDymW4pwKEj/view	2026-03-02 15:00:30.306784
39	2f9c2336-0250-4260-ab70-b1bca0bee47b	11	fixed	380000.00	fixed	250000.00	\N	2026-03-02 15:01:05.081977
40	2f9c2336-0250-4260-ab70-b1bca0bee47b	12	pct	1.50	pct	1.50	\N	2026-03-02 15:01:05.089677
41	2f9c2336-0250-4260-ab70-b1bca0bee47b	13	fixed	620000.00	fixed	620000.00	\N	2026-03-02 15:01:05.094762
42	2f9c2336-0250-4260-ab70-b1bca0bee47b	14	pct	2.00	pct	2.00	\N	2026-03-02 15:01:05.099877
43	942123b5-a03e-4091-8395-8325ea1993b9	15	pct	2.20	pct	2.50	\N	2026-03-02 15:01:05.104987
44	19e5e2bd-97bd-46fd-ae02-2926bca1ab0a	16	pct	1.80	pct	2.00	\N	2026-03-02 15:01:05.109691
45	905c5323-dcbd-4eeb-b944-acd6d4f6a037	16	pct	1.80	pct	2.00	\N	2026-03-02 15:01:05.11384
46	b06cf954-52bd-499e-b9ab-3640cd440dfb	16	pct	1.80	pct	2.00	\N	2026-03-02 15:01:05.118235
47	3c6c31c7-976b-4f23-9bd3-8fb57a9789a4	16	pct	2.00	pct	2.50	\N	2026-03-02 15:01:05.122757
\.


--
-- Data for Name: consultants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.consultants (id, name, email, phone, specialization, created_at) FROM stdin;
11	Osus International	\N	\N	Architecture & Engineering	2026-03-02 15:00:29.813844
12	Realistic Engineering	\N	\N	Architecture & Engineering	2026-03-02 15:00:29.924254
13	DATUM Engineering Consultants	\N	\N	Architecture & Engineering	2026-03-02 15:00:30.022387
14	ARTEC Architectural & Engineering Consultants	\N	\N	Architecture & Engineering	2026-03-02 15:00:30.026909
15	LACASA	\N	\N	Architecture & Engineering	2026-03-02 15:00:30.031103
16	Safeer Engineering Consultants (SEC)	\N	\N	Architecture & Engineering	2026-03-02 15:00:30.035755
\.


--
-- Data for Name: contracts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contracts (id, project_id, contractor_name, contractor_name_ar, contract_type, contract_value, retention_percent, performance_bond_percent, ld_terms, start_date, end_date, status, awarded_at, created_at) FROM stdin;
16	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Al Rashid Contracting LLC	شركة الراشد للمقاولات ذ.م.م	Main Contractor	39428000	5.00	10.00	غرامة تأخير: 0.1% يومياً، سقف 10%	2025-03-01	2027-03-01	ACTIVE	2025-02-20 00:00:00	2026-03-01 23:21:36.104308
17	905c5323-dcbd-4eeb-b944-acd6d4f6a037	WSP Middle East	WSP الشرق الأوسط	Design Consultant	788560	0.00	0.00	\N	2024-11-01	2027-06-01	ACTIVE	2024-10-15 00:00:00	2026-03-01 23:21:36.104308
18	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Faithful+Gould	فيثفل آند جولد	Quantity Surveyor	350000	0.00	0.00	\N	2024-12-01	2027-06-01	ACTIVE	2024-11-20 00:00:00	2026-03-01 23:21:36.104308
19	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Provis Real Estate	بروفيس العقارية	Sales Agent	6804000	0.00	0.00	عمولة 7% على إجمالي المبيعات	2025-04-01	2027-06-01	ACTIVE	2025-03-25 00:00:00	2026-03-01 23:21:36.104308
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.conversations (id, title, created_at) FROM stdin;
\.


--
-- Data for Name: draft_decisions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.draft_decisions (id, run_id, agent_id, project_id, proposal_id, decision_type, title_en, title_ar, rationale, recommended_action, impact, status, decided_by, decided_at, created_at) FROM stdin;
\.


--
-- Data for Name: evaluator_scores; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.evaluator_scores (id, project_id, consultant_id, evaluator_id, criterion_id, score, created_at) FROM stdin;
\.


--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expenses (id, project_id, category, description, amount, consultant_certificate_approved, status, created_at) FROM stdin;
e1c59a51-9807-49c9-8c51-777709a3684f	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Soft Cost	سداد قيمة الأرض	18000000.00	f	approved	2025-03-01 00:00:00
a6b389b4-c1fb-4c71-b0c1-1445168e71b3	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Soft Cost	رسم تسجيل الأرض	720000.00	f	approved	2025-03-02 00:00:00
e828fdba-cf65-4f7f-859d-d35abbb038b1	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Soft Cost	رسوم التصميم	473136.00	f	approved	2025-03-10 00:00:00
ad204316-5694-4685-bc67-2d4e355cccc5	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Soft Cost	رسوم الإشراف	172497.00	f	approved	2025-03-10 00:00:00
37ca2074-f371-418e-81a9-afb15e7c0757	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Soft Cost	فحص تربة ومسح وطبوغرافي	45000.00	f	approved	2025-01-20 00:00:00
9524cdb2-2577-4718-a410-c1bb052c0f1a	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Soft Cost	رسوم حكومية	500000.00	f	approved	2025-03-15 00:00:00
3c744f1b-5ae7-452c-a9b6-c17e8859f473	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Soft Cost	رسوم RERA	207100.00	f	approved	2025-03-05 00:00:00
a5a5a2ed-b766-4b2c-b533-d7f2103f7f27	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Soft Cost	تسويق وإعلان	200000.00	f	approved	2025-04-15 00:00:00
684b1ef7-d7be-4c86-9962-43e3c94aca44	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Soft Cost	رسوم إسكرو وبنكية	160000.00	f	approved	2025-03-01 00:00:00
7276b921-4734-4456-bb15-1b500a6dc5dd	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Hard Cost	IPC #1 — أعمال حفر	1800000.00	f	approved	2025-04-15 00:00:00
2f2a6b75-52ea-4140-83e8-ee40d6d0c349	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Hard Cost	IPC #2 — خرسانة أساسات	1465789.00	f	approved	2025-05-20 00:00:00
\.


--
-- Data for Name: extraction_fields; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.extraction_fields (id, extraction_run_id, canonical_field, extracted_value, confidence, evidence_type, evidence_page, evidence_cell, evidence_snippet, created_at) FROM stdin;
\.


--
-- Data for Name: extraction_runs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.extraction_runs (id, document_id, agent_run_id, classification, classification_confidence, raw_text, detected_tables, page_count, status, error_message, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: feasibility_studies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feasibility_studies (id, project_id, project_name, community, plot_number, project_description, land_use, plot_area, gfa_residential, gfa_retail, gfa_offices, total_gfa, saleable_residential_pct, saleable_retail_pct, saleable_offices_pct, number_of_units, land_price, agent_commission_land_pct, soil_investigation, authorities_fee, construction_cost_per_sqft, design_fee_pct, supervision_fee_pct, contingencies_pct, developer_fee_pct, agent_commission_sale_pct, marketing_pct, rera_offplan_fee, rera_unit_fee, noc_fee, escrow_fee, residential_sale_price, retail_sale_price, offices_sale_price, profit_share_pct, scenario_name, notes, created_at, report_executive_summary, report_market_study, report_location_analysis, report_risk_analysis, report_sensitivity_analysis, report_legal_compliance, report_recommendations, report_status, report_competitive_analysis, report_product_strategy, report_pricing_strategy, report_absorption_forecast, report_cash_flow_projection, report_jv_sensitivity, report_risk_quant, report_executive_brief, report_exit_strategy, report_board_summary, report_development_cost, saleable_residential, saleable_retail, estimated_construction_area, res_1br_pct, res_2br_pct, res_3br_pct, res_1br_avg_size, res_2br_avg_size, res_3br_avg_size, shop_small_pct, shop_medium_pct, shop_large_pct, shop_small_avg_size, shop_medium_avg_size, shop_large_avg_size, finishes_quality, pricing_scenarios, approved_scenario, competitive_pricing_fields, topography_survey, bank_charges, community_fee, surveyor_fees, rera_audit_reports, rera_inspection_reports) FROM stdin;
30	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Vertix – ند الشبا قطعة 1	Nad Al Sheba, Dubai	6185392	Residential Apartments (G+2P+6), Commercial Retail 	Residential Apartments (G+2P+6), Commercial Retail 	16942	48090	4090	0	52180	90	99	90	54	18000000	0	25000	150000	345	2	2	3	5	5	2	150000	850	10000	140000	0	0	0	0	السيناريو الأساسي - ند الشبا		2026-03-02 13:16:30.643942	# نظرة عامة وتحليل السوق\n\n## الجزء أ — نظرة عامة على المشروع\n\n**اسم المشروع:** Vertix – ند الشبا قطعة 1  \n**الموقع:** ند الشبا، دبي  \n**رقم القطعة:** 6185392  \n**مساحة الأرض:** 16,942 sqft  \n**الاستخدام المسموح:** شقق سكنية (G+2P+6) ومحلات تجارية  \n\n**وصف المشروع:**  \nالمشروع عبارة عن مبنى سكني يتألف من طابق أرضي، طابقين مخصصين لمواقف السيارات، وستة طوابق سكنية. كما يشمل المشروع مساحات تجارية للاستخدام التجاري، مما يعزز جمال التصميم والتنوع في الاستخدام الوظيفي. يتكون المبنى من إجمالي 54 وحدة سكنية، إلى جانب المساحة القابلة للبيع للشقق والتي تقدر بحوالي 48,090 sqft، والمساحات التجارية القابلة للبيع والتي تبلغ 4,000 sqft.  \n\n**المطور الرئيسي:** شركة كومو للتطوير العقاري  \n**هيئة التطوير:** بلدية دبي ودائرة الأراضي والأملاك في دبي  \n\n**تموضع المشروع:**  \nالمشروع يتموضع تحت فئة **"متوسط إلى ممتاز"**، حيث يوفر وحدات سكنية بأسعار معقولة بالنسبة للجودة والتصميم، مع مراعاة موقعه الحيوي القريب من ند الشبا.  \n\n**المعلمات الرئيسية:**  \n- **إجمالي GFA:** 52,180 sqft  \n- **BUA (مساحة البناء الفعلية):** 114,284 sqft  \n- **المساحة القابلة للبيع:** 52,090 sqft (48,090 sqft سكني و4,000 sqft تجاري).\n\n---\n\n## الجزء ب — التحليل التنظيمي والتخطيطي\n\n**تحليل التنطيق والاستخدام المسموح:**  \nالاستخدام المحدد للأرض هو للأغراض السكنية والتجارية، مما يتيح فرصة التنويع بين شقق سكنية ومساحات تجارية. هذا التنطيق يضع المشروع ضمن إطار قانون التخطيط العمراني لبلدية دبي.  \n\n**نسبة FAR / ارتفاع المبنى:**  \nالنسبة الإجمالية للبناء (FAR) تتماشى مع ضوابط المنطقة المعتمدة، حيث يقتصر البناء على طابق أرضي، طابقين لمواقف السيارات، وستة طوابق فوقها.  \n\n**متطلبات تسجيل ريرا (قانون 19 لسنة 2020):**  \nيتطلب المشروع التسجيل لدى ريرا وفق القانون رقم 19 لعام 2020، ويستلزم وجود حساب ضمان لحماية حقوق المستثمرين.  \n\n**لوائح حساب الضمان (قاعدة 20% من تكلفة البناء):**  \nيجب تخصيص مبلغ قدره AED 7,885,596 كحساب ضمان أولي، بناءً على 20% من تكلفة البناء الإجمالية.  \n\n**رسوم تسجيل ونقل دائرة الأراضي (4%):**  \nرسوم التسجيل للعقارات تقدر بـ 4% من قيمة العقار، وهي إلزامية عند إدخال المشروع للسوق.  \n\n**متطلبات رخصة البناء (بلدية دبي):**  \nالمشروع يتطلب تقديم مستندات تصميم البناء لإصدار رخصة بناء وموافقات من بلدية دبي وجميع الجهات المختصة.  \n\n**أحكام تخلف المشتري (قانون 19/2020):**  \nيمنح القانون رقم 19 لعام 2020 حلولاً تنظيمية للجهات العاملة في حالة تخلف المشتري عن الدفع، بما في ذلك تفعيل بنود عقد البيع.  \n\n**صندوق الاحتفاظ 5%:**  \nبعد إنجاز المشروع، يتم حجز 5% من قيمة المشروع لمدة 365 يوم لضمان تسليم الوحدات وفق المواصفات المحددة.  \n\n---\n\n## الجزء ج — تحليل الموقع\n\n**وصف المنطقة والاتصالية:**  \nند الشبا تقع جنوب شرق دبي وتتميز بموقعها الاستراتيجي على مقربة من شارع الشيخ محمد بن زايد وطرق رئيسية أخرى، مما يتيح سهولة الوصول إلى مختلف أجزاء مدينة دبي.  \n\n**القرب من المعالم الرئيسية والمترو:**  \nالمشروع يقع على بعد مسافة قصيرة من دبي مول، برج خليفة، والمنطقة الإعلامية، فضلاً عن قربه من محطات مترو رئيسية.  \n\n**المرافق المجتمعية والبنية التحتية:**  \nتتميز منطقة ند الشبا بوجود المدارس، الحدائق، والمرافق الصحية، إضافة إلى مراكز التسوق والخدمات العامة.  \n\n**خطط تطوير المنطقة والنمو المستقبلي:**  \nمنطقة ند الشبا تشهد تطورات مستمرة خاصة في مجال البنية التحتية وتوسعة شبكة المواصلات، ما يزيد من جاذبيتها الاستثمارية.  \n\n**الديموغرافيا وميزة الموقع التنافسية:**  \nتُعرف ند الشبا بأنها منطقة جاذبة للمستثمرين العائليين والمستخدمين النهائيين بفضل هدوء المنطقة مقارنة بمراكز المدينة الصاخبة.  \n\n---\n\n## الجزء د — تحليل السوق\n\n**أوضاع سوق دبي العقاري الحالية (2025-2026):**  \nتُظهر سوق العقارات في دبي نمواً مستداماً بدفع من الإصلاحات الحكومية، زيادة التعداد السكاني، والتوسع السياحي.  \n\n**محركات الطلب:**  \nتشمل المحركات الرئيسية الطلب في السوق العقاري إصلاحات التأشيرات، الإقامة الذهبية، والاستثمارات العالية الناتجة عن الاستقرار السياسي والاقتصادي في دولة الإمارات.  \n\n**ديناميكيات العرض والطلب في السوق الفرعي المحدد:**  \nمنطقة ند الشبا تظهر توازنًا بين العرض والطلب، حيث لا تزال فرصة النمو مهيمنة نظراً لقلة المشاريع الكبيرة في المنطقة.  \n\n**حجم المعاملات الأخيرة واتجاهاتها في المنطقة:**  \nالمعاملات العقارية في ند الشبا شهدت ارتفاعاً ملحوظاً خلال العامين الماضيين، بدعم من تزايد الطلب مع ارتفاع واضح في أسعار البيع لكل قدم².  \n\n**اتجاهات السعر لكل قدم²:**  \nبالنظر إلى المرحلة الحالية، الأسعار لكل قدم² في المشاريع السكنية المتوسطة في ند الشبا سجلت استقراراً على مدى 12-24 شهراً الماضية.  \n\n**تقسيم سوق البيع على المخطط مقابل الجاهز:**  \nتُظهر مبيعات الوحدات على المخطط معدلات أعلى بالمقارنة مع الوحدات الجاهزة، على اعتبار أن المشاريع الجديدة توفر تقسيماً مرناً للدفع.  \n\n**تحليل ملف المشتري (الجنسية، مستثمر مقابل مستخدم نهائي):**  \nالمستخدم النهائي يشكل النسبة الأعلى من المشترين في ند الشبا، مع حصة كبيرة للمقيمين من الجنسيات الآسيوية والعربية.  \n\n**العرض الحالي والقادم في السوق الفرعي:**  \nالعرض في السوق الفرعي محدود، ويمكن أن تستفيد المشاريع الجديدة مثل Vertix من هذه الديناميكية لتحقيق مبيعات قوية.  \n\n**إطلاقات المشاريع الجديدة وتأثيرها:**  \nإطلاق مشاريع إضافية في المنطقة قد يعزز خيارات المشترين ويضيف المزيد من الحيوية للسوق الفرعي، مما يدعم نمو الطلب.  \n\n**توقعات معدل الاستيعاب لمشاريع مماثلة:**  \nبالنظر إلى نوعية المشروع ووضع السوق، من المتوقع أن يتم استيعاب الوحدات السكنية خلال فترة 12 - 18 شهر بعد الإطلاق.  \n\n**التوقعات قصيرة المدى ومتوسطة المدى:**  \nالمعدل السنوي المتوقع على المدى القصير (12-24 شهراً) يتجه نحو استقرار مع احتمالية زيادة الطلب بعد اكتمال المشاريع المجاورة. على المدى المتوسط (24-36 شهراً)، النمو سيكون مدفوعًا بالتوسع السكاني والزيادة في الطرح التجاري.  \n\n**ملف المشتري/المستأجر المستهدف:**  \nالمشروع يركز على المستخدمين النهائيين من العائلات الصغيرة، المهنيين، وكذلك الشركات المحلية الباحثة عن مساحات تجارية صغيرة.  \n\n---\n\n**ملاحظة:** "ينتظر تحديد أسعار البيع".	\N	\N	\N	\N	\N	\N	partial	## القسم الثاني: المنافسة واستراتيجية التسعير\n\n---\n\n### الجزء أ — التحليل التنافسي\n\nفيما يلي مقارنة لأبرز المشاريع في السوق الفرعي في ند الشبا ودبي، وهي مشاريع مشابهة من حيث الموقع والطبيعة السكنية (شقق + تجاري):\n\n| المشروع                  | المطور                 | أنواع الوحدات         | متوسط السعر (AED/قدم²) | خطة الدفع            | تاريخ الإنجاز     | إجمالي الوحدات | المصدر                          |\n|--------------------------|------------------------|------------------------|-------------------------|----------------------|-------------------|----------------|---------------------------------|\n| MBR Residences Phase 1  | Sobha Realty          | 1-3 غرف               | 1,750                  | 60/40               | Q4 2025           | 180            | [المصدر: DLD، طبقة 1]           |\n| Al Meydan Vista          | Meydan Group          | استوديو - 3 غرف       | 1,580                  | 50/50               | Q2 2026           | 120            | [المصدر: Property Monitor، طبقة 2] |\n| Azure Apartments         | Select Group          | 1-2 غرف               | 1,600                  | 70/30               | Q1 2025           | 90             | [المصدر: REIDIN، طبقة 2]        |\n| Creek Vistas Grande      | Sobha Realty          | 1-3 غرف               | 1,870                  | 65/35               | Q3 2024           | 200            | [المصدر: DLD، طبقة 1]           |\n| Nad Al Sheba Gardens     | Meraas                | فيلات                 | 1,450                  | 50/50               | Q4 2024           | 100            | [المصدر: DLD، طبقة 1]           |\n\n#### **نقاط القوة والضعف مقارنةً بالمنافسين:**\n- نقاط القوة: موقع مشروع Vertix في ند الشبا يمنح اتصالاً ممتازاً مع الطرق الرئيسية؛ استخدام الشقق السكنية مع إضافة وحدات للتجزئة يُعتبر ميزة للمزج الوظيفي.\n- نقاط الضعف: المنافسة تواجه تحديات في تقديم أسعار تنافسية مع المطورين الكبار مثل Sobha وMeraas، بالإضافة إلى نقص تحديد أسعار واضحة حاليًا.\n\n#### **الفجوة السوقية:**\n- هناك نقص ملحوظ في المشاريع التي تخدم الفئات ذات الدخل المتوسط في ند الشبا. كما أن المشاريع ذات التصاميم المتكاملة مع مرافق مبتكرة موجهة نحو العائلات تعد فرصة لتعبئة فجوة مبدعة في السوق.\n\n**ملاحظة جودة البيانات**: درجة الثقة A — المصادر الرئيسية كانت موثوقة (DLD، Property Monitor، REIDIN) مع تطابق نسبي كبير بين البيانات.\n\n---\n\n### الجزء ب — استراتيجية المنتج ومزيج الوحدات\n\n#### **أنواع الوحدات المقترحة:**\n- **استوديوهات**: عدد محدود (6) بمساحات من 400-500 قدم².\n- **غرف وصالة**: (24 وحدة) بمساحات تبدأ من 700 حتى 950 قدم²، وهي التركيبة الأساسية.\n- **غرفتين وصالة**: (18 وحدة) بمساحات من 1,000 إلى 1,250 قدم².\n- **تجاري - تجزئة**: (6 وحدات) بمساحات من 600-1,000 قدم².\n\n#### **ملف المشتري المستهدف لكل نوع:**\n- **استوديوهات**: الشباب المهنيين والمستأجرين على المدى القريب الذين يبحثون عن دخول سوق التملك.\n- **غرف وصالة**: العائلات الناشئة أو المستثمرين المتوسطين.\n- **غرفتين وصالة**: عائلات أكبر أو مستثمرين يبحثون عن عوائد تأجير أعلى.\n- **تجزئة**: الشركات الصغيرة والمطاعم الفاخرة.\n\n#### **المميزات المتميزة:**\n- تصاميم فاخرة مع استخدام الوظائف متعددة الاستخدامات (Mixed-Use).\n- مرافق ممتازة: صالة ألعاب رياضية، حمام سباحة، ومنطقة أطفال.\n\n#### **كفاءة لوحة الطابق واستراتيجية المرافق:**\n- يتميز التصميم المعماري بكفاءة استخدام المساحات، حيث تم تخصيص 84% من المساحة المبنية لأغراض قابلة للبيع.\n- المرافق مهيأة لتلبية احتياجات جميع أنواع المستخدمين مع توفير مناطق خضراء.\n\n---\n\n### الجزء ج — استراتيجية التسعير\n\n#### **نطاق السعر لكل نوع (AED/قدم²):**\n\n| نوع الوحدة     | متفائل       | أساسي        | متحفظ       | المصدر                          |\n|----------------|--------------|--------------|-------------|---------------------------------|\n| استوديو        | 1,650        | 1,550        | 1,450       | [المصدر: Property Monitor، طبقة 2] |\n| 1 غرفة وصالة   | 1,600        | 1,500        | 1,400       | [المصدر: REIDIN، طبقة 2]        |\n| 2 غرف وصالة    | 1,550        | 1,450        | 1,350       | [المصدر: Property Monitor، طبقة 2] |\n| تجاري - تجزئة | 2,200        | 2,000        | 1,800       | تقديري — لا يوجد مصدر موثق، درجة C |\n\n#### **استراتيجية التسعير التدريجي:**\n- رفع التسعير بنسبة 3-5% بين كل مرحلة بناء لتجاوز معدلات التضخم وزيادة الطلب.\n\n#### **مصفوفة علاوة الطابق والإطلالة:**\n- **علاوة الطوابق**: +5% للأدوار العليا، خصم 3% للأرضي.\n- **علاوة الإطلالة**:\n  1. إطلالة على الحديقة: +10%.\n  2. إطلالة على المدينة: قياسية.\n\n#### **توصية هيكل خطة الدفع:**\nتمكّن خطة الدفع 70/30 المبيعات خلال فترة البناء:\n- 10% حجوزات.\n- 60% خلال مراحل البناء.\n- 30% عند التسليم.\n\n#### **سعر التعادل لكل قدم²:**\n- بناءً على إجمالي التكاليف (TDC): سعر التعادل يبلغ حوالي **AED 1,279/قدم²**.\n\n#### **مقارنة بأسعار المعاملات المحققة:**\n- معاملات مشروع Al Meydan Vista تشير إلى متوسط تسعير 1,580 AED/قدم² [المصدر: DLD، طبقة 1].\n- هذه الأرقام تشير إلى إمكان تحقيق تسعير الهيئة الأساسي.\n\n**مصالحة المصادر**: لم تظهر تعارضات حرجة في قيم التسعير؛ الاعتماد على مصادر الطبقة 1 و2 موثوق بنسبة كبيرة.\n\n---	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	48090	4000	114284	50	40	10	900	1200	1500	40	30	30	300	600	1500	premium	[{"name":"السيناريو المتفائل","res1brPsf":1650,"res2brPsf":1550,"res3brPsf":1500,"shopSmallPsf":2200,"shopMediumPsf":2200,"shopLargePsf":2200,"bookingPct":10,"constructionPct":60,"handoverPct":30,"deferredPct":0,"bookingTiming":"","constructionTiming":"","handoverTiming":"","deferredTiming":""},{"name":"السيناريو الأساسي","res1brPsf":1550,"res2brPsf":1450,"res3brPsf":1400,"shopSmallPsf":2000,"shopMediumPsf":2000,"shopLargePsf":2000,"bookingPct":10,"constructionPct":60,"handoverPct":30,"deferredPct":0,"bookingTiming":"","constructionTiming":"","handoverTiming":"","deferredTiming":""},{"name":"السيناريو المتحفظ","res1brPsf":1450,"res2brPsf":1350,"res3brPsf":1300,"shopSmallPsf":1800,"shopMediumPsf":1800,"shopLargePsf":1800,"bookingPct":10,"constructionPct":60,"handoverPct":30,"deferredPct":0,"bookingTiming":"","constructionTiming":"","handoverTiming":"","deferredTiming":""}]	0	{"optimistic":{"res1brPsf":1650,"res2brPsf":1550,"res3brPsf":1500,"shopSmallPsf":2200,"shopMediumPsf":2200,"shopLargePsf":2200},"base":{"res1brPsf":1550,"res2brPsf":1450,"res3brPsf":1400,"shopSmallPsf":2000,"shopMediumPsf":2000,"shopLargePsf":2000},"conservative":{"res1brPsf":1450,"res2brPsf":1350,"res3brPsf":1300,"shopSmallPsf":1800,"shopMediumPsf":1800,"shopLargePsf":1800},"paymentPlan":{"bookingPct":10,"constructionPct":60,"handoverPct":30,"deferredPct":0}}	8000	20000	17000	12000	18000	105000
\.


--
-- Data for Name: governance_gates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.governance_gates (id, project_id, gate_code, gate_name, gate_name_ar, status, required_conditions, evaluation_result, decided_by, decided_at, created_at) FROM stdin;
30	905c5323-dcbd-4eeb-b944-acd6d4f6a037	G1_RERA_COMPLIANCE	RERA Compliance Gate	بوابة الامتثال لـ RERA	PASSED	{"conditions": ["إيداع 20% من TCC", "تسجيل المطور", "فتح حساب إسكرو"]}	{"notes": "جميع الشروط مستوفاة", "score": 100}	owner	2025-02-28 00:00:00	2026-03-01 23:21:36.104308
31	905c5323-dcbd-4eeb-b944-acd6d4f6a037	G2_ESCROW_READY	Escrow Readiness Gate	بوابة جاهزية الإسكرو	PASSED	{"conditions": ["حساب إسكرو مفتوح", "شهادة QS", "تسجيل RERA"]}	{"notes": "الحساب مفتوح وجاهز", "score": 100}	owner	2025-03-01 00:00:00	2026-03-01 23:21:36.104308
32	905c5323-dcbd-4eeb-b944-acd6d4f6a037	G3_TENDER_COMPLETE	Tender Completion Gate	بوابة إنجاز المناقصة	PASSED	{"conditions": ["تقييم العروض", "اختيار المقاول", "توقيع العقد"]}	{"notes": "الراشد — أفضل عرض تقني ومالي", "score": 95}	owner	2025-02-20 00:00:00	2026-03-01 23:21:36.104308
33	905c5323-dcbd-4eeb-b944-acd6d4f6a037	G4_CONSTRUCTION_START	Construction Start Gate	بوابة بدء البناء	PASSED	{"conditions": ["رخصة بناء", "عقد مقاول", "RERA 20% مودع"]}	{"notes": "أمر بالبدء صدر", "score": 100}	owner	2025-03-01 00:00:00	2026-03-01 23:21:36.104308
34	905c5323-dcbd-4eeb-b944-acd6d4f6a037	G5_SALES_LAUNCH	Sales Launch Gate	بوابة إطلاق المبيعات	PASSED	{"conditions": ["تسجيل RERA", "حساب إسكرو", "خطة دفع", "وكيل مبيعات"]}	{"notes": "المبيعات انطلقت أبريل 2025", "score": 100}	owner	2025-04-01 00:00:00	2026-03-01 23:21:36.104308
35	905c5323-dcbd-4eeb-b944-acd6d4f6a037	G6_COMPLETION	Completion Gate	بوابة الإنجاز	PENDING	{"conditions": ["إنجاز 100%", "شهادة إنجاز", "دفاع مدني"]}	\N	\N	\N	2026-03-01 23:21:36.104308
36	905c5323-dcbd-4eeb-b944-acd6d4f6a037	G7_HANDOVER	Handover Gate	بوابة التسليم	PENDING	{"conditions": ["شهادة إنجاز", "سندات ملكية", "OA"]}	\N	\N	\N	2026-03-01 23:21:36.104308
\.


--
-- Data for Name: ipcs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ipcs (id, project_id, contract_id, ipc_number, period_from, period_to, gross_certified_value, retention_deduction, advance_recovery, penalties, net_payable, physical_progress, status, approved_by, approved_at, paid_at, created_at) FROM stdin;
23	905c5323-dcbd-4eeb-b944-acd6d4f6a037	16	1	2025-03-01	2025-03-31	1800000	90000	0	0	1710000	5	PAID	استشاري المشروع	2025-04-10 00:00:00	2025-04-15 00:00:00	2026-03-01 23:21:36.104308
24	905c5323-dcbd-4eeb-b944-acd6d4f6a037	16	2	2025-04-01	2025-04-30	1465789	73289	0	0	1392500	12	PAID	استشاري المشروع	2025-05-12 00:00:00	2025-05-20 00:00:00	2026-03-01 23:21:36.104308
25	905c5323-dcbd-4eeb-b944-acd6d4f6a037	16	3	2025-05-01	2025-05-31	2400000	120000	0	0	2280000	17	APPROVED	استشاري المشروع	2025-06-08 00:00:00	\N	2026-03-01 23:21:36.104308
\.


--
-- Data for Name: knowledge_base; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.knowledge_base (id, domain, category, title, content, keywords, source, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: layla_conversations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.layla_conversations (id, user_id, role, content, intent, project_id, created_at) FROM stdin;
\.


--
-- Data for Name: leadership_directives; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leadership_directives (id, project_id, type, subject, message, reply, replied_at, status, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.messages (id, conversation_id, role, content, created_at) FROM stdin;
\.


--
-- Data for Name: payment_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_plans (id, project_id, plan_name, plan_name_ar, total_amount, installments, created_at) FROM stdin;
9	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Standard Payment Plan	خطة الدفع الأساسية	2025000	[{"name": "Booking", "amount": 303750, "nameAr": "الحجز", "dueEvent": "عند الحجز", "percentage": 15}, {"name": "1st Installment", "amount": 202500, "nameAr": "القسط الأول", "dueEvent": "خلال 30 يوم", "percentage": 10}, {"name": "2nd Installment", "amount": 202500, "nameAr": "القسط الثاني", "dueEvent": "إنجاز 20%", "percentage": 10}, {"name": "3rd Installment", "amount": 202500, "nameAr": "القسط الثالث", "dueEvent": "إنجاز 40%", "percentage": 10}, {"name": "4th Installment", "amount": 202500, "nameAr": "القسط الرابع", "dueEvent": "إنجاز 60%", "percentage": 10}, {"name": "5th Installment", "amount": 101250, "nameAr": "القسط الخامس", "dueEvent": "إنجاز 80%", "percentage": 5}, {"name": "Handover", "amount": 810000, "nameAr": "التسليم", "dueEvent": "عند التسليم", "percentage": 40}]	2026-03-01 23:21:36.104308
\.


--
-- Data for Name: portfolio_metrics; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.portfolio_metrics (id, total_free_equity, total_committed, total_escrow_locked, total_burned, total_retention, portfolio_exposure_ratio, liquidity_runway_months, project_count, computed_at) FROM stdin;
139	2500000	4922267	542500	23537733	163289	0.758	8.5	6	2026-03-01 23:21:36.104308
140	31605727	5272267	542500	44457733	163289	0.606	34.1	8	2026-03-01 23:22:22.700858
141	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-01 23:27:16.288228
142	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:03:45.871028
143	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:08:28.198445
144	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:09:37.237645
145	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:10:07.365619
146	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:10:12.830246
147	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:11:33.858958
148	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:15:41.830801
149	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:16:40.576952
150	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:17:26.6485
151	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:23:57.545632
152	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:24:23.240101
153	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:24:23.282598
154	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:28:58.37588
155	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:29:16.536239
156	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:29:36.896198
157	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:29:38.610298
158	34605727	9272267	542500	44457733	163289	0.603	37.4	8	2026-03-02 00:35:01.671984
159	29075021	515000	8428096	49889917	163289	0.572	28.0	8	2026-03-02 00:36:21.545743
160	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 00:37:28.057928
161	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 00:37:31.122071
162	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:10:34.41626
163	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:10:37.125593
164	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:10:38.645187
165	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:12:01.738275
166	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:17:54.183542
167	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:17:55.596964
168	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:18:00.321303
169	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:18:17.881
170	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:18:18.966591
171	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:19:34.568304
172	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:24:06.092835
173	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:24:38.005556
174	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:24:42.926226
175	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:24:57.874746
176	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:24:59.22302
177	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:31:51.703875
178	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:41:00.147542
179	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:41:01.723846
180	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:41:38.946375
181	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:42:47.700987
182	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 01:42:51.416166
183	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 02:01:09.951341
184	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 02:01:11.799024
185	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 02:05:59.068213
186	30295021	515000	8428096	49889917	163289	0.564	29.1	8	2026-03-02 02:06:03.23141
187	1189294	165000	8428096	28969917	163289	0.749	0.2	1	2026-03-02 02:12:43.517913
188	1189294	165000	8428096	28969917	163289	0.749	0.2	1	2026-03-02 02:12:44.920893
189	1189294	165000	8428096	28969917	163289	0.749	0.2	1	2026-03-02 02:12:55.283078
190	1189294	165000	8428096	28969917	163289	0.749	0.2	1	2026-03-02 02:13:08.589127
191	1189294	165000	8428096	28969917	163289	0.749	0.2	1	2026-03-02 02:13:12.753801
192	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:17:04.984618
193	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:17:08.243517
194	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:25:20.82417
195	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:25:22.511147
196	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:27:51.752576
197	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:27:56.769104
198	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:29:20.713078
199	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:29:24.596325
200	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:30:37.924958
201	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:30:42.085975
202	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:33:14.273412
203	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:33:43.554687
204	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:33:46.637987
205	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:36:23.097819
206	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:36:26.908565
207	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:37:55.183773
208	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:38:35.084916
209	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:38:39.997442
210	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:40:55.153855
211	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:41:18.553081
212	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:41:22.611505
213	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:43:40.967591
214	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:43:43.277532
215	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:43:48.256372
216	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:48:04.970729
217	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:48:10.416222
218	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:51:41.903654
219	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:51:46.467354
220	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 02:56:49.291315
221	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 03:07:18.944159
222	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 03:09:56.846899
223	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 03:10:45.71154
224	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 03:11:46.50472
225	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 03:11:51.472557
226	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 03:37:53.238055
227	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 03:40:44.088588
228	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 03:46:07.112911
229	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 05:59:48.099091
230	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 07:46:39.824204
231	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 08:09:33.89529
232	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 08:19:44.444596
233	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 09:24:30.182313
234	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 10:16:06.83137
235	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 10:16:07.541937
236	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 10:19:05.364775
237	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 10:22:56.094352
238	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 10:28:37.383007
239	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 10:33:28.940375
240	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 10:38:22.795266
241	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 10:49:12.759861
242	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 11:19:15.877945
243	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 11:19:17.187489
244	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 12:01:52.666493
245	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 12:01:53.599225
246	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 12:03:37.061529
247	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 12:03:39.690257
248	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 12:09:52.576559
249	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 12:11:32.52353
250	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 12:11:49.336276
251	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 12:13:24.622826
252	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 12:13:35.646922
253	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 12:39:48.834856
254	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 13:13:23.663178
255	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 13:52:37.091084
256	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 14:24:54.767046
257	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 15:00:13.977337
258	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 15:42:20.621318
259	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 16:03:10.747944
260	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 16:11:53.442497
261	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 16:12:52.988512
262	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 16:13:39.109132
263	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 16:14:21.896962
264	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 16:14:49.833058
265	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 16:21:26.482581
266	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 16:21:31.333127
267	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 16:23:09.456806
268	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 16:23:12.51782
269	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 16:26:29.576078
270	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 16:27:50.211102
271	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 16:42:49.941502
272	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 16:45:09.400334
273	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 17:02:58.566889
274	1189294	165000	8428096	28969917	163289	0.749	1.5	6	2026-03-02 17:13:18.229583
\.


--
-- Data for Name: project_assumptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_assumptions (id, project_id, key, value, units, previous_value, owner_approved, approved_by, approved_at, rationale, source_id, joelle_suggested, created_at) FROM stdin;
\.


--
-- Data for Name: project_budget_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_budget_items (id, project_id, category, item_key, label_en, label_ar, amount, percentage, percentage_base, sort_order, is_auto_calculated, created_at) FROM stdin;
75	905c5323-dcbd-4eeb-b944-acd6d4f6a037	design_consultancy	soil_investigation	Soil Investigation Report	تقرير فحص التربة	25000.00	\N	\N	12	f	2026-03-01 23:10:04.200769
76	905c5323-dcbd-4eeb-b944-acd6d4f6a037	design_consultancy	topography_survey	Topography Survey Works	أعمال المساحة الطبوغرافية	8000.00	\N	\N	13	f	2026-03-01 23:10:04.204542
77	905c5323-dcbd-4eeb-b944-acd6d4f6a037	design_consultancy	surveyor_fees	Surveyor Fees	رسوم المساح	12000.00	\N	\N	14	f	2026-03-01 23:10:04.207941
80	905c5323-dcbd-4eeb-b944-acd6d4f6a037	government_fees	community_fee	Community Fee	رسوم مجتمعية	16000.00	\N	\N	22	f	2026-03-01 23:10:04.21811
83	905c5323-dcbd-4eeb-b944-acd6d4f6a037	rera_registration	rera_offplan_registration	RERA Off-plan Registration	رسوم تسجيل المشروع RERA	150000.00	\N	\N	40	f	2026-03-01 23:10:04.237187
70	905c5323-dcbd-4eeb-b944-acd6d4f6a037	land_costs	land_price	Land Price	قيمة الأرض	18000000.00	\N	\N	1	f	2026-03-01 23:10:04.182474
71	905c5323-dcbd-4eeb-b944-acd6d4f6a037	land_costs	agent_commission_land	Agent Commission (Land)	عمولة وكيل الأرض	0.00	0.00	land_price	2	f	2026-03-01 23:10:04.187055
72	905c5323-dcbd-4eeb-b944-acd6d4f6a037	land_costs	land_registration_fee	Land Registration Fee (4%)	رسم تسجيل الأرض (4%)	720000.00	4.00	land_price	3	t	2026-03-01 23:10:04.190828
73	905c5323-dcbd-4eeb-b944-acd6d4f6a037	design_consultancy	design_fee	Project Design Fee	رسوم التصميم	788560.00	2.00	construction_cost	10	t	2026-03-01 23:10:04.194322
74	905c5323-dcbd-4eeb-b944-acd6d4f6a037	design_consultancy	supervision_fee	Project Supervision Fee	رسوم الإشراف	689990.00	1.75	construction_cost	11	t	2026-03-01 23:10:04.197616
78	905c5323-dcbd-4eeb-b944-acd6d4f6a037	government_fees	authorities_fee	Authorities Fee	رسوم الجهات الحكومية	1000000.00	\N	\N	20	f	2026-03-01 23:10:04.210738
79	905c5323-dcbd-4eeb-b944-acd6d4f6a037	government_fees	separation_fee	Separation Fee (40 × GFA)	رسوم الفصل (40 × GFA)	2033040.00	40.00	gfa_multiply	21	t	2026-03-01 23:10:04.214299
84	905c5323-dcbd-4eeb-b944-acd6d4f6a037	rera_registration	rera_unit_registration	RERA Unit Registration Fees	رسوم تسجيل الوحدات RERA	39100.00	\N	\N	41	f	2026-03-01 23:10:04.241371
85	905c5323-dcbd-4eeb-b944-acd6d4f6a037	rera_registration	rera_audit_reports	RERA Audit Reports	تقارير تدقيق RERA	18000.00	\N	\N	42	f	2026-03-01 23:10:04.247681
86	905c5323-dcbd-4eeb-b944-acd6d4f6a037	rera_registration	rera_inspection_reports	RERA Inspection Reports	تقارير تفتيش RERA	105000.00	\N	\N	43	f	2026-03-01 23:10:04.250761
87	905c5323-dcbd-4eeb-b944-acd6d4f6a037	rera_registration	noc_developer	NOC to Sell - Developer Fees	NOC المطور	10000.00	\N	\N	44	f	2026-03-01 23:10:04.253298
90	905c5323-dcbd-4eeb-b944-acd6d4f6a037	financial_admin	escrow_bank_fees	Escrow Bank Account Fees	رسوم حساب الإسكرو	140000.00	\N	\N	60	f	2026-03-01 23:10:04.261879
91	905c5323-dcbd-4eeb-b944-acd6d4f6a037	financial_admin	bank_charges	Bank Charges	رسوم بنكية	20000.00	\N	\N	61	f	2026-03-01 23:10:04.26437
81	905c5323-dcbd-4eeb-b944-acd6d4f6a037	construction	construction_cost	Estimated Construction Cost	تكلفة البناء التقديرية	39427980.00	\N	\N	30	t	2026-03-01 23:10:04.230478
82	905c5323-dcbd-4eeb-b944-acd6d4f6a037	construction	contingencies	Contingencies & Others (2%)	طوارئ وأخرى (2%)	788560.00	2.00	construction_cost	31	t	2026-03-01 23:10:04.2343
88	905c5323-dcbd-4eeb-b944-acd6d4f6a037	marketing_sales	agent_commission_sale	Agent Commission (Sales 7%)	عمولة وكلاء البيع (7%)	6803996.00	7.00	total_sales	50	t	2026-03-01 23:10:04.256598
89	905c5323-dcbd-4eeb-b944-acd6d4f6a037	marketing_sales	marketing_advertisement	Marketing & Advertisement	تسويق وإعلان	500000.00	\N	\N	51	f	2026-03-01 23:10:04.259351
92	905c5323-dcbd-4eeb-b944-acd6d4f6a037	financial_admin	developer_fee	Developer Fixed Fee (5%)	أتعاب المطور (5%)	1971399.00	5.00	total_project_cost_ex_developer	62	t	2026-03-01 23:10:04.267051
\.


--
-- Data for Name: project_cash_flows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_cash_flows (id, project_id, month, type, source, amount, description, category, linked_activity_id, created_at) FROM stdin;
\.


--
-- Data for Name: project_consultants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_consultants (id, project_id, consultant_id, created_at) FROM stdin;
32	2f9c2336-0250-4260-ab70-b1bca0bee47b	11	2026-03-02 15:00:30.040073
33	2f9c2336-0250-4260-ab70-b1bca0bee47b	12	2026-03-02 15:00:30.167083
34	2f9c2336-0250-4260-ab70-b1bca0bee47b	13	2026-03-02 15:00:30.171339
35	2f9c2336-0250-4260-ab70-b1bca0bee47b	14	2026-03-02 15:00:30.175515
36	942123b5-a03e-4091-8395-8325ea1993b9	13	2026-03-02 15:00:30.17939
37	942123b5-a03e-4091-8395-8325ea1993b9	14	2026-03-02 15:00:30.183228
38	942123b5-a03e-4091-8395-8325ea1993b9	15	2026-03-02 15:00:30.187028
39	19e5e2bd-97bd-46fd-ae02-2926bca1ab0a	11	2026-03-02 15:00:30.191119
40	19e5e2bd-97bd-46fd-ae02-2926bca1ab0a	12	2026-03-02 15:00:30.194773
41	19e5e2bd-97bd-46fd-ae02-2926bca1ab0a	13	2026-03-02 15:00:30.198282
42	19e5e2bd-97bd-46fd-ae02-2926bca1ab0a	14	2026-03-02 15:00:30.202224
43	19e5e2bd-97bd-46fd-ae02-2926bca1ab0a	16	2026-03-02 15:00:30.206274
44	905c5323-dcbd-4eeb-b944-acd6d4f6a037	12	2026-03-02 15:00:30.210083
45	905c5323-dcbd-4eeb-b944-acd6d4f6a037	13	2026-03-02 15:00:30.214063
46	905c5323-dcbd-4eeb-b944-acd6d4f6a037	14	2026-03-02 15:00:30.217362
47	905c5323-dcbd-4eeb-b944-acd6d4f6a037	16	2026-03-02 15:00:30.221017
48	b06cf954-52bd-499e-b9ab-3640cd440dfb	12	2026-03-02 15:00:30.224324
49	b06cf954-52bd-499e-b9ab-3640cd440dfb	13	2026-03-02 15:00:30.228301
50	b06cf954-52bd-499e-b9ab-3640cd440dfb	14	2026-03-02 15:00:30.231457
51	b06cf954-52bd-499e-b9ab-3640cd440dfb	16	2026-03-02 15:00:30.235365
52	3c6c31c7-976b-4f23-9bd3-8fb57a9789a4	12	2026-03-02 15:00:30.238545
53	3c6c31c7-976b-4f23-9bd3-8fb57a9789a4	13	2026-03-02 15:00:30.241615
54	3c6c31c7-976b-4f23-9bd3-8fb57a9789a4	14	2026-03-02 15:00:30.24568
55	3c6c31c7-976b-4f23-9bd3-8fb57a9789a4	16	2026-03-02 15:00:30.249844
\.


--
-- Data for Name: project_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_documents (id, project_id, filename, original_name, mime_type, file_size, document_type, source_system, dataset_type, checksum, uploaded_by, notes, created_at, stage_item_id) FROM stdin;
\.


--
-- Data for Name: project_financials; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_financials (id, project_id, total_project_cost, equity_required, bank_finance, sales_target, project_duration_months, sales_delay_months, notes, created_at) FROM stdin;
3	905c5323-dcbd-4eeb-b944-acd6d4f6a037	75653914.00	50025727.00	0.00	97189003.00	24	0	Vertix — TPC=75,653,914 | GDV=97,189,003 | Profit=21,535,089 | ROI=28.5%	2026-03-02 00:28:56.212324
\.


--
-- Data for Name: project_scenarios; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_scenarios (id, project_id, feasibility_study_id, scenario_type, name, construction_cost_adj, sale_price_adj, absorption_adj, gdv, tdc, net_profit, roi, irr, equity_irr, peak_cash_need, funding_gap, sales_duration_months, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: project_state_transitions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_state_transitions (id, project_id, from_state, to_state, triggered_by, reason, gates_passed, capital_snapshot, created_at) FROM stdin;
44	905c5323-dcbd-4eeb-b944-acd6d4f6a037	\N	S0_ACTIVATED	owner	تفعيل المشروع	\N	\N	2024-10-01 00:00:00
45	905c5323-dcbd-4eeb-b944-acd6d4f6a037	S0_ACTIVATED	S1_CONSULTANTS_PROCURED	owner	تعيين WSP + F&G	\N	\N	2024-11-01 00:00:00
46	905c5323-dcbd-4eeb-b944-acd6d4f6a037	S1_CONSULTANTS_PROCURED	S2_DESIGN_IN_PROGRESS	system	بدء التصميم	\N	\N	2024-11-15 00:00:00
47	905c5323-dcbd-4eeb-b944-acd6d4f6a037	S2_DESIGN_IN_PROGRESS	S3_REGULATORY_IN_PROGRESS	system	تقديم طلبات الموافقات	\N	\N	2025-01-10 00:00:00
48	905c5323-dcbd-4eeb-b944-acd6d4f6a037	S3_REGULATORY_IN_PROGRESS	S4_READY_FOR_TENDER	system	جاهز للمناقصة	{G1_RERA_COMPLIANCE}	\N	2025-01-20 00:00:00
49	905c5323-dcbd-4eeb-b944-acd6d4f6a037	S4_READY_FOR_TENDER	S5_TENDER_IN_PROGRESS	owner	إطلاق المناقصة	\N	\N	2025-01-25 00:00:00
50	905c5323-dcbd-4eeb-b944-acd6d4f6a037	S5_TENDER_IN_PROGRESS	S6_CONTRACT_AWARDED	owner	ترسية العقد — الراشد	{G3_TENDER_COMPLETE}	\N	2025-02-20 00:00:00
51	905c5323-dcbd-4eeb-b944-acd6d4f6a037	S6_CONTRACT_AWARDED	S9_CONSTRUCTION_ACTIVE	system	بدء البناء	{G4_CONSTRUCTION_START}	\N	2025-03-01 00:00:00
52	905c5323-dcbd-4eeb-b944-acd6d4f6a037	S9_CONSTRUCTION_ACTIVE	S8_SALES_ACTIVE	system	إطلاق المبيعات	{G5_SALES_LAUNCH}	\N	2025-04-01 00:00:00
\.


--
-- Data for Name: project_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_tasks (id, project_id, phase, task_name, start_date, end_date, amount_aed, wallet_source, is_revenue, created_at) FROM stdin;
a626b757-7b55-48e0-b543-864a801e4445	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Pre-Construction	شراء الأرض وتسجيلها	2024-09-01 00:00:00	2024-11-01 00:00:00	18720000.00	Wallet_A	f	2026-03-01 23:21:36.104308
0c39e795-8cd5-45bf-846b-6aca9524fec3	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Pre-Construction	التصميم والاستشارات	2024-11-01 00:00:00	2025-01-15 00:00:00	690633.00	Wallet_A	f	2026-03-01 23:21:36.104308
da7c46bd-5fa2-40cb-a9f5-4a89bdec5511	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Pre-Construction	التراخيص والموافقات	2025-01-10 00:00:00	2025-03-01 00:00:00	847100.00	Wallet_A	f	2026-03-01 23:21:36.104308
f57a34ef-740c-4a16-9275-2f02666b0f58	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Construction	تعبئة الموقع والحفر	2025-03-01 00:00:00	2025-04-15 00:00:00	1800000.00	Wallet_B	f	2026-03-01 23:21:36.104308
9abd1263-c720-4d86-ac1b-483a7206c2fc	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Construction	خرسانة الأساسات	2025-04-15 00:00:00	2025-06-30 00:00:00	1465789.00	Wallet_B	f	2026-03-01 23:21:36.104308
e8678d15-8e1a-4d34-91f6-1c74680dddc6	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Construction	مبيعات مسبقة — حجوزات	2025-04-01 00:00:00	2025-06-15 00:00:00	3645000.00	Wallet_B	t	2026-03-01 23:21:36.104308
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (id, name, location, total_gfa, sellable_area, construction_cost_per_sqft, status, created_at, retained_5_percent_fund, retention_release_date, completed_at, approved_sale_price_per_sqft, title_deed_number, dda_number, master_dev_ref, plot_area_sqm, plot_area_sqft, permitted_use, ownership_type, master_dev_name, seller_name, buyer_name, buyer_nationality, buyer_phone, buyer_email, electricity_allocation, water_allocation, sewage_allocation, effective_date, construction_period, governing_law, notes, plot_number, area_code, gfa_sqm, gfa_sqft, subdivision_restrictions, master_dev_address, seller_address, buyer_passport, buyer_address, trip_am, trip_lt, trip_pm, construction_start_date, completion_date, construction_conditions, sale_restrictions, resale_conditions, community_charges, registration_authority, admin_fee, clearance_fee, compensation_amount, dispute_resolution, bua_sqft, sellable_area_residential, sellable_area_retail, sellable_area_offices, units_residential, units_retail, units_offices, land_price, agent_commission_land_pct) FROM stdin;
19e5e2bd-97bd-46fd-ae02-2926bca1ab0a	مبنى الجداف السكني (G+7)	Al Jadaf, Dubai	105000.00	94500.00	370.00	Pre-study	2026-03-02 02:16:48.361258	0.00	\N	\N	\N	\N	DDA-JAD-3260885	Jadaf	1114.84	12001.00	Residential (G+7)	Freehold	Meraas / Dubai Holding	Meraas / Dubai Holding	COMO Real Estate Development	UAE	\N	info@como-dev.com	\N	\N	\N	\N	28 months	\N	مبنى سكني في الجداف G+7.	3260885	Jadaf	9754.85	105000.00	\N	Dubai Holding HQ, Al Jaddaf, Dubai	Al Jaddaf, Dubai, UAE	\N	\N	\N	\N	\N	2026-12-01	Q2 2025	\N	\N	\N	\N	\N	\N	\N	\N	\N	84000.00	\N	\N	\N	\N	\N	\N	\N	\N
2f9c2336-0250-4260-ab70-b1bca0bee47b	مركز مجان التجاري (G+4)	Al Majan, Dubai	850000.00	765000.00	370.00	Pre-study	2026-03-02 02:16:48.365084	0.00	\N	\N	\N	\N	DDA-MAJ-6457956	Maj-M	836.13	9000.00	Commercial (G+4 Retail/Office)	Freehold	Dubai Properties	Dubai Properties	COMO Real Estate Development	UAE	\N	info@como-dev.com	\N	\N	\N	\N	24 months	\N	مركز تجاري في مجان، تصميم G+4.	6457956	Maj-M	4180.65	45000.00	\N	Dubai Properties HQ, Business Bay, Dubai	Business Bay, Dubai, UAE	\N	\N	\N	\N	\N	2026-11-01	Q1 2027	\N	\N	\N	\N	\N	\N	\N	\N	\N	36000.00	\N	\N	\N	\N	\N	\N	\N	\N
3c6c31c7-976b-4f23-9bd3-8fb57a9789a4	ند الشبا – قطعة 3 الفلل	Nad Al Sheba, Dubai	30000.00	27000.00	370.00	Pre-study	2026-03-02 02:16:48.350564	0.00	\N	\N	\N	\N	DDA-NAS-6180578	Nas-R	929.03	10000.00	Residential (Villas)	Freehold	Nakheel PJSC	Nakheel PJSC	COMO Real Estate Development	UAE	\N	info@como-dev.com	\N	\N	\N	\N	18 months	\N	قطعة 3 الفلل - ند الشبا.	6180578	Nas-R	2787.09	30000.00	\N	Nakheel Sales Centre, Palm Jumeirah, Dubai	Palm Jumeirah, Dubai, UAE	\N	\N	\N	\N	\N	2026-09-01	Q2 2026	\N	\N	\N	\N	\N	\N	\N	\N	\N	10000.00	\N	\N	\N	\N	\N	\N	\N	\N
b06cf954-52bd-499e-b9ab-3640cd440dfb	ند الشبا – قطعة 2 المدمجة	Nad Al Sheba, Dubai	205000.00	184500.00	370.00	Pre-study	2026-03-02 02:16:48.356433	0.00	\N	\N	\N	\N	DDA-NAS-6182776	Nas-R	2045.60	22019.50	Mixed Use Residential (G+4 / Compound Villas)	Freehold	Nakheel PJSC	Nakheel PJSC	COMO Real Estate Development	UAE	\N	info@como-dev.com	\N	\N	\N	\N	30 months	\N	قطعة 2 المدمجة - ند الشبا، مجمع فلل.	6182776	Nas-R	8182.40	88079.00	\N	Nakheel Sales Centre, Palm Jumeirah, Dubai	Palm Jumeirah, Dubai, UAE	\N	\N	\N	\N	\N	2027-01-01	Q1 2027	\N	\N	\N	\N	\N	\N	\N	\N	\N	66059.00	\N	\N	\N	\N	\N	\N	\N	\N
942123b5-a03e-4091-8395-8325ea1993b9	مجان متعدد الاستخدامات (G+4P+25)	Al Majan, Dubai	875300.00	787770.00	370.00	Pre-study	2026-03-02 02:16:48.368471	0.00	\N	\N	\N	\N	DDA-MAJ-6457879	Maj-M	3716.12	40000.00	Mixed Use (G+4P+25 Residential/Commercial)	Freehold	Dubai Properties	Dubai Properties	COMO Real Estate Development	UAE	\N	info@como-dev.com	\N	\N	\N	\N	36 months	\N	برج متعدد الاستخدامات في مجان G+4P+25 - أكبر مشروع.	6457879	Maj-M	81302.00	875300.00	\N	Dubai Properties HQ, Business Bay, Dubai	Business Bay, Dubai, UAE	\N	\N	\N	\N	\N	2027-03-01	Q2 2028	\N	\N	\N	\N	\N	\N	\N	\N	\N	700240.00	\N	\N	\N	\N	\N	\N	\N	\N
905c5323-dcbd-4eeb-b944-acd6d4f6a037	Vertix – ند الشبا قطعة 1	Nad Al Sheba, Dubai	50826.00	52090.00	345.00	Active	2026-02-27 01:08:09.454029	0.00	\N	\N	1866.00	2153	618-5392	NASGNA19-022	1573.97	16942.07	Residential Apartments (G+2P+6), Commercial Retail 	Single Ownership Property	Shamal Estates LLC (MERAAS ESTATES L.L.C)	TALEB SADEGHFARD و AHMAD SADEGHFARD	COMO Real Estate Development	UAE	+971-XX-XXXXXXX	info@como-dev.com	150 kW	25 m³/day	20 m³/day	2023	18 months	UAE Federal Law & Dubai Land Department Regulations		6185392	NASGNA19-022	4722.58	50826.11	لا يُسمح بتقسيم القطعة 	P.O. Box 123311, Dubai, UAE	Dubai, UAE	—	Villa 7, Algeria Street, Mirdif, Dubai, UAE	15	10	18	2025-11-01	Q2 2027	الحصول على رخصة البناء من بلدية دبي وموافقة المطور الرئيسي	لا يجوز بيع الوحدات قبل إنجاز 20% من البناء (قانون RERA)	يجب الحصول على NOC من المطور الرئيسي قبل إعادة البيع	15 درهم/قدم² سنوياً (تقديري)	دائرة الأراضي والأملاك - دبي	5000	1000	0	مركز التحكيم التابع لمحاكم دبي (DIAC)	114284.00	48090.00	4000.00	0.00	48	6	0	18000000.00	0.00
\.


--
-- Data for Name: proposal_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.proposal_items (id, proposal_id, target_table, target_id, field_name, old_value, new_value, confidence, evidence_type, evidence_ref, evidence_page, evidence_snippet, created_at) FROM stdin;
\.


--
-- Data for Name: recommendations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recommendations (id, run_id, agent_id, project_id, category, title_en, title_ar, description_en, description_ar, priority, action_required, metadata, status, resolved_by, resolved_at, created_at) FROM stdin;
\.


--
-- Data for Name: reconciliation_ledger; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reconciliation_ledger (id, project_id, metric_id, metric_name, metric_definition, geo_boundary_id, window_start, window_end, source_a_name, source_a_file, source_a_value, source_b_name, source_b_file, source_b_value, variance_pct, weights_applied, decision_value, confidence_grade, exception_notes, owners_approval_required, approved_by, approved_at, created_at) FROM stdin;
\.


--
-- Data for Name: reconciliation_proposals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reconciliation_proposals (id, run_id, agent_id, project_id, document_id, title_en, title_ar, description, status, approved_by, approved_at, rejection_reason, created_at) FROM stdin;
\.


--
-- Data for Name: regulatory_dependencies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.regulatory_dependencies (id, node_id, depends_on_node_id, dependency_type) FROM stdin;
\.


--
-- Data for Name: regulatory_nodes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.regulatory_nodes (id, project_id, node_type, status, document_ref, notes, updated_at, updated_by) FROM stdin;
60	905c5323-dcbd-4eeb-b944-acd6d4f6a037	DLD_TITLE	APPROVED	DLD-2025-VTX-001	سند ملكية مسجل — قطعة 6185392 ند الشبا	2026-03-01 23:21:36.104308	owner
61	905c5323-dcbd-4eeb-b944-acd6d4f6a037	RERA_DEV_REG	APPROVED	RERA-DEV-2025-0847	تسجيل مطور عقاري — كومو للتطوير	2026-03-01 23:21:36.104308	owner
62	905c5323-dcbd-4eeb-b944-acd6d4f6a037	ESCROW_OPENING	APPROVED	ESC-ENBD-2025-VTX	حساب إسكرو — بنك الإمارات دبي الوطني	2026-03-01 23:21:36.104308	owner
63	905c5323-dcbd-4eeb-b944-acd6d4f6a037	QS_TCC_CERT	APPROVED	QS-CERT-2025-0291	شهادة مساح كميات — TCC: 39,427,980	2026-03-01 23:21:36.104308	consultant
64	905c5323-dcbd-4eeb-b944-acd6d4f6a037	MUNICIPALITY_PLANNING	APPROVED	DM-PLAN-2025-NAS-047	موافقة تخطيط البلدية — G+7 سكني	2026-03-01 23:21:36.104308	system
65	905c5323-dcbd-4eeb-b944-acd6d4f6a037	BUILDING_PERMIT	APPROVED	BP-2025-NAS-1892	رخصة بناء — صالحة حتى 2027-03-01	2026-03-01 23:21:36.104308	system
66	905c5323-dcbd-4eeb-b944-acd6d4f6a037	CIVIL_DEFENSE	SUBMITTED	\N	مخططات الحريق مقدمة — بانتظار الموافقة	2026-03-01 23:21:36.104308	consultant
67	905c5323-dcbd-4eeb-b944-acd6d4f6a037	DEWA_NOC	APPROVED	DEWA-NOC-2025-38291	شهادة عدم ممانعة ديوا	2026-03-01 23:21:36.104308	system
68	905c5323-dcbd-4eeb-b944-acd6d4f6a037	MASTER_DEV_NOC	APPROVED	MD-NOC-SHAMAL-2025-012	عدم ممانعة المطور الرئيسي — Shamal Estates	2026-03-01 23:21:36.104308	system
69	905c5323-dcbd-4eeb-b944-acd6d4f6a037	OQOOD_ACTIVATION	IN_PROGRESS	\N	تفعيل نظام عقود — بانتظار إدخال الوحدات	2026-03-01 23:21:36.104308	owner
70	905c5323-dcbd-4eeb-b944-acd6d4f6a037	PROJECT_REG_RERA	APPROVED	RERA-PROJ-2025-VTX-001	تسجيل المشروع — Vertix Residences	2026-03-01 23:21:36.104308	owner
71	905c5323-dcbd-4eeb-b944-acd6d4f6a037	COMPLETION_CERT	NOT_STARTED	\N	شهادة إنجاز — غير مطبقة	2026-03-01 23:21:36.104308	\N
72	905c5323-dcbd-4eeb-b944-acd6d4f6a037	UNIT_TITLE_ISSUANCE	NOT_STARTED	\N	إصدار سندات ملكية — غير مطبق	2026-03-01 23:21:36.104308	\N
\.


--
-- Data for Name: report_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.report_versions (id, feasibility_study_id, project_id, version_number, version_status, gdv, tdc, net_profit, profit_margin_pct, project_irr, equity_irr, expected_sales_duration, funding_gap, risk_level, recommendation, required_action, report_snapshot, technical_validation, financial_validation, legal_validation, validated_by, validated_at, issued_at, created_at) FROM stdin;
\.


--
-- Data for Name: risk_scores; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.risk_scores (id, project_id, liquidity_risk, sales_risk, construction_risk, regulatory_risk, portfolio_risk, total_risk, lsr, ecr, risk_level_project, signals, computed_at) FROM stdin;
11	905c5323-dcbd-4eeb-b944-acd6d4f6a037	22.000	32.000	15.000	8.000	18.000	20.500	1.380	0.870	LOW	["✅ نسبة ضغط السيولة (LSR) 1.38 — صحية", "✅ نسبة تغطية الضمان (ECR) 87% — جيدة", "✅ التقدم الإنشائي (17%) متوافق مع الجدول", "📊 نسبة المبيعات 21% — بداية جيدة", "⚠️ شهادة الدفاع المدني لم تصدر بعد"]	2026-03-01 23:21:36.104308
12	905c5323-dcbd-4eeb-b944-acd6d4f6a037	90.000	75.000	10.000	50.000	20.000	57.300	0.053	999.000	HIGH	["⚠️ نسبة ضغط السيولة أقل من 1.0", "🔴 سيولة حرجة — لجنة رأس المال مطلوبة", "⚠️ سرعة المبيعات أقل من 40%"]	2026-03-01 23:22:38.667685
13	905c5323-dcbd-4eeb-b944-acd6d4f6a037	90.000	75.000	10.000	50.000	60.000	61.300	0.221	0.178	HIGH	["⚠️ نسبة ضغط السيولة أقل من 1.0", "🔴 سيولة حرجة — لجنة رأس المال مطلوبة", "⚠️ سرعة المبيعات أقل من 40%", "⚠️ نسبة تغطية الضمان أقل من 80%"]	2026-03-01 23:23:47.234409
14	905c5323-dcbd-4eeb-b944-acd6d4f6a037	90.000	75.000	10.000	50.000	60.000	61.300	0.485	0.090	HIGH	["⚠️ نسبة ضغط السيولة أقل من 1.0", "🔴 سيولة حرجة — لجنة رأس المال مطلوبة", "⚠️ سرعة المبيعات أقل من 40%", "⚠️ نسبة تغطية الضمان أقل من 80%"]	2026-03-01 23:24:25.621824
15	905c5323-dcbd-4eeb-b944-acd6d4f6a037	45.000	75.000	10.000	50.000	60.000	47.800	1.273	0.036	MEDIUM	["⚠️ سرعة المبيعات أقل من 40%", "⚠️ نسبة تغطية الضمان أقل من 80%"]	2026-03-01 23:25:06.142253
16	905c5323-dcbd-4eeb-b944-acd6d4f6a037	45.000	75.000	10.000	50.000	60.000	47.800	1.273	0.013	MEDIUM	["⚠️ سرعة المبيعات أقل من 40%", "⚠️ نسبة تغطية الضمان أقل من 80%"]	2026-03-01 23:26:16.807505
17	905c5323-dcbd-4eeb-b944-acd6d4f6a037	45.000	75.000	10.000	50.000	60.000	47.800	1.273	0.013	MEDIUM	["⚠️ سرعة المبيعات أقل من 40%", "⚠️ نسبة تغطية الضمان أقل من 80%"]	2026-03-02 00:22:35.369081
18	905c5323-dcbd-4eeb-b944-acd6d4f6a037	90.000	75.000	10.000	50.000	60.000	61.300	0.120	0.202	HIGH	["⚠️ نسبة ضغط السيولة أقل من 1.0", "🔴 سيولة حرجة — لجنة رأس المال مطلوبة", "⚠️ سرعة المبيعات أقل من 40%", "⚠️ نسبة تغطية الضمان أقل من 80%"]	2026-03-02 01:32:01.861858
19	905c5323-dcbd-4eeb-b944-acd6d4f6a037	90.000	75.000	10.000	50.000	60.000	61.300	0.120	0.202	HIGH	["⚠️ نسبة ضغط السيولة أقل من 1.0", "🔴 سيولة حرجة — لجنة رأس المال مطلوبة", "⚠️ سرعة المبيعات أقل من 40%", "⚠️ نسبة تغطية الضمان أقل من 80%"]	2026-03-02 01:58:04.223128
20	905c5323-dcbd-4eeb-b944-acd6d4f6a037	90.000	75.000	10.000	50.000	60.000	61.300	0.120	0.202	HIGH	["⚠️ نسبة ضغط السيولة أقل من 1.0", "🔴 سيولة حرجة — لجنة رأس المال مطلوبة", "⚠️ سرعة المبيعات أقل من 40%", "⚠️ نسبة تغطية الضمان أقل من 80%"]	2026-03-02 02:10:53.468055
21	905c5323-dcbd-4eeb-b944-acd6d4f6a037	90.000	75.000	10.000	50.000	60.000	61.300	0.120	0.202	HIGH	["⚠️ نسبة ضغط السيولة أقل من 1.0", "🔴 سيولة حرجة — لجنة رأس المال مطلوبة", "⚠️ سرعة المبيعات أقل من 40%", "⚠️ نسبة تغطية الضمان أقل من 80%"]	2026-03-02 02:16:06.117417
22	905c5323-dcbd-4eeb-b944-acd6d4f6a037	90.000	75.000	10.000	50.000	60.000	61.300	0.120	0.202	HIGH	["⚠️ نسبة ضغط السيولة أقل من 1.0", "🔴 سيولة حرجة — لجنة رأس المال مطلوبة", "⚠️ سرعة المبيعات أقل من 40%", "⚠️ نسبة تغطية الضمان أقل من 80%"]	2026-03-02 03:07:26.052504
23	905c5323-dcbd-4eeb-b944-acd6d4f6a037	90.000	75.000	10.000	50.000	60.000	61.300	0.120	0.202	HIGH	["⚠️ نسبة ضغط السيولة أقل من 1.0", "🔴 سيولة حرجة — لجنة رأس المال مطلوبة", "⚠️ سرعة المبيعات أقل من 40%", "⚠️ نسبة تغطية الضمان أقل من 80%"]	2026-03-02 07:55:23.195979
24	905c5323-dcbd-4eeb-b944-acd6d4f6a037	90.000	75.000	10.000	50.000	60.000	61.300	0.120	0.202	HIGH	["⚠️ نسبة ضغط السيولة أقل من 1.0", "🔴 سيولة حرجة — لجنة رأس المال مطلوبة", "⚠️ سرعة المبيعات أقل من 40%", "⚠️ نسبة تغطية الضمان أقل من 80%"]	2026-03-02 08:19:49.057313
\.


--
-- Data for Name: sales_units; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sales_units (id, project_id, unit_number, unit_type, floor, area, asking_price, unit_status, buyer_name, sale_price, sale_date, oqood_registered, oqood_date, payment_plan_id, created_at) FROM stdin;
289	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-G01	Studio	0	450.00	1150000	SOLD	أحمد محمد الفلاسي	1120000	2025-04-18	t	2025-05-02	9	2026-03-01 23:21:36.104308
290	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-G02	Studio	0	450.00	1150000	SOLD	فاطمة خالد العلي	1150000	2025-04-18	t	2025-05-02	9	2026-03-01 23:21:36.104308
291	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-101	1BR	1	750.00	1750000	SOLD	سعيد عبدالله المزروعي	1750000	2025-04-20	t	2025-05-05	9	2026-03-01 23:21:36.104308
292	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-102	1BR	1	750.00	1750000	SOLD	نورة حسن الشامسي	1700000	2025-04-22	t	2025-05-08	9	2026-03-01 23:21:36.104308
293	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-201	2BR	2	1100.00	2650000	SOLD	خالد إبراهيم النعيمي	2600000	2025-04-25	t	2025-05-10	9	2026-03-01 23:21:36.104308
294	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-202	1BR	2	750.00	1800000	SOLD	مريم علي المنصوري	1800000	2025-05-01	t	2025-05-15	9	2026-03-01 23:21:36.104308
295	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-301	2BR	3	1100.00	2750000	SOLD	عمر يوسف الحمادي	2700000	2025-05-05	t	2025-05-20	9	2026-03-01 23:21:36.104308
296	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-302	1BR	3	750.00	1850000	SOLD	هند سالم الكتبي	1850000	2025-05-10	f	\N	9	2026-03-01 23:21:36.104308
297	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-401	2BR	4	1100.00	2850000	SOLD	محمد سلطان الظاهري	2800000	2025-05-12	f	\N	9	2026-03-01 23:21:36.104308
298	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-402	Studio	4	500.00	1300000	SOLD	ليلى عبدالرحمن الهاشمي	1280000	2025-05-15	f	\N	9	2026-03-01 23:21:36.104308
299	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-501	2BR	5	1100.00	2950000	RESERVED	راشد محمد البلوشي	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
300	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-502	1BR	5	800.00	1950000	RESERVED	عائشة سعيد المهيري	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
301	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-503	1BR	5	800.00	1950000	RESERVED	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
302	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-G03	Studio	0	480.00	1200000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
303	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-G04	Studio	0	480.00	1200000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
304	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-103	1BR	1	750.00	1750000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
305	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-104	Studio	1	500.00	1250000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
306	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-105	1BR	1	780.00	1800000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
307	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-203	2BR	2	1050.00	2550000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
308	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-204	1BR	2	780.00	1850000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
309	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-205	Studio	2	500.00	1300000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
310	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-303	2BR	3	1050.00	2650000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
311	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-304	1BR	3	780.00	1900000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
312	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-305	Studio	3	500.00	1350000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
313	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-403	2BR	4	1050.00	2750000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
314	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-404	1BR	4	780.00	1950000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
315	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-405	Studio	4	520.00	1400000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
316	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-504	2BR	5	1100.00	2950000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
317	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-505	1BR	5	800.00	2000000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
318	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-601	3BR	6	1500.00	3800000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
319	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-602	2BR	6	1100.00	3050000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
320	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-603	2BR	6	1050.00	2950000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
321	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-604	1BR	6	800.00	2100000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
322	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-605	Studio	6	520.00	1500000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
323	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-701	3BR Penthouse	7	2200.00	5500000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
324	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-702	3BR	7	1500.00	3950000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
325	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-703	2BR	7	1100.00	3150000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
326	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-704	2BR	7	1050.00	3050000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
327	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-705	1BR	7	800.00	2200000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
328	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-G05	Retail	0	1200.00	3600000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
329	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-G06	Retail	0	900.00	2700000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
330	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-G07	Retail	0	650.00	1950000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
331	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-G08	Retail	0	550.00	1650000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
332	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-G09	Retail	0	680.00	2040000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:21:36.104308
333	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-106	1BR	1	780.00	1780000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:22:53.100939
334	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-206	Studio	2	500.00	1280000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:22:53.100939
335	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-306	1BR	3	780.00	1880000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:22:53.100939
336	905c5323-dcbd-4eeb-b944-acd6d4f6a037	VTX-406	Studio	4	520.00	1380000	AVAILABLE	\N	\N	\N	f	\N	\N	2026-03-01 23:22:53.100939
\.


--
-- Data for Name: source_registry; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.source_registry (id, name, tier, access_method, url, description, fields_provided, refresh_cadence, license_notes, is_active, created_at) FROM stdin;
13	Dubai Land Department (DLD)	tier1_official	manual_file	https://dubailand.gov.ae	السجل الرسمي لجميع المعاملات العقارية وصكوك الملكية في دبي	{transaction_price,transaction_date,property_type,area,plot_number,buyer_nationality,mortgage_data}	Daily	Government open data; some datasets require registration	t	2026-03-01 11:54:41.733409
14	Property Monitor (PM)	tier2_primary	manual_file	https://propertymonitor.ae	منصة تحليلات عقارية شاملة تغطي معاملات دبي وخط الإمداد واتجاهات السوق	{avg_price_psf,transaction_volume,supply_pipeline,absorption_rate,rental_yields,market_trends}	Monthly	Subscription required; enterprise license for API access	t	2026-03-01 11:54:41.738487
15	REIDIN	tier2_primary	manual_file	https://reidin.com	مؤشرات عقارية ومعايير مرجعية للأسواق الناشئة بما فيها دبي	{price_index,rental_index,area_benchmarks,historical_trends,comparable_transactions}	Monthly	Subscription required; data licensing terms apply	t	2026-03-01 11:54:41.742224
16	JLL (Jones Lang LaSalle)	tier3_professional	manual_file	https://jll.ae	أبحاث سوقية وتقييمات واستشارات للسوق العقاري في دبي	{market_outlook,sector_reports,capital_values,rental_rates,vacancy_rates,investment_volumes}	Quarterly	Public reports available; detailed data requires engagement	t	2026-03-01 11:54:41.745517
17	CBRE	tier3_professional	manual_file	https://cbre.ae	خدمات عقارية تجارية واستثمارية مع تغطية شاملة لسوق دبي	{market_reports,rental_analysis,investment_yields,occupancy_rates,development_pipeline}	Quarterly	Public reports available; bespoke research requires engagement	t	2026-03-01 11:54:41.748874
18	Knight Frank (KF)	tier3_professional	manual_file	https://knightfrank.ae	استشارات عقارية عالمية مع بيانات عن القطاع السكني والتجاري في دبي	{prime_residential_index,luxury_market_data,wealth_report,rental_analysis,capital_values}	Quarterly	Public reports available; detailed data by request	t	2026-03-01 11:54:41.75176
19	Property Finder (PF)	tier4_listings	scrape	https://propertyfinder.ae	بوابة عقارية رائدة مع بيانات إعلانات البيع والإيجار في دبي	{listing_prices,asking_rents,inventory_count,days_on_market,agent_listings,area_coverage}	Real-time	Public listing data; bulk access requires partnership	t	2026-03-01 11:54:41.754519
20	Bayut	tier4_listings	scrape	https://bayut.com	منصة إعلانات عقارية رئيسية مع أسعار طلب ومخزون واتجاهات لسوق دبي	{listing_prices,asking_rents,market_trends,popular_areas,price_per_sqft,inventory_levels}	Real-time	Public listing data; API access via partnership	t	2026-03-01 11:54:41.758329
21	Dubai Statistics Center (DSC/DDSE)	tier1_official	manual_file	https://dsc.gov.ae	الجهة الإحصائية الرسمية لبيانات السكان والاقتصاد في دبي	{population_data,gdp_growth,employment_stats,tourism_data,construction_permits,trade_data}	Quarterly	Government open data portal	t	2026-03-01 11:54:41.76136
22	Data.Dubai (Smart Dubai)	tier1_official	api	https://data.dubai.ae	منصة البيانات المفتوحة لحكومة دبي	{building_permits,infrastructure_projects,population_density,land_use_data,utility_connections}	Monthly	Open data; API access available	t	2026-03-01 11:54:41.764913
23	DubaiNow	tier1_official	api	https://dubainow.com	منصة الخدمات الحكومية الموحدة لدبي	{ejari_data,trakheesi_permits,utility_bills,government_fees,service_requests}	Real-time	Government platform; integration via API	t	2026-03-01 11:54:41.768176
24	Dubai REST	tier1_official	api	https://dubairest.gov.ae	منصة دائرة الأراضي للمعاملات الذاتية والتقييمات العقارية	{transaction_history,property_valuations,ownership_records,mortgage_status,noc_status,escrow_accounts}	Real-time	Government platform; requires DLD account	t	2026-03-01 11:54:41.770368
\.


--
-- Data for Name: stage_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stage_items (id, project_id, phase, title, title_ar, href, status, sort_order, is_system, created_at, code, description, owner, planned_start_date, planned_end_date, is_board_level, cash_outflow, cash_inflow, description_ar, required_docs, required_docs_ar, notes) FROM stdin;
187	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.1	Supply & demand analysis	تحليل العرض والطلب	\N	not_started	0	t	2026-03-01 13:59:53.076506	1.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
188	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.1	Price & rental analysis	تحليل الأسعار والإيجارات	\N	not_started	1	t	2026-03-01 13:59:53.115073	1.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
189	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.1	Competing projects study	دراسة المشاريع المنافسة	\N	not_started	2	t	2026-03-01 13:59:53.12768	1.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
190	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.1	Target customer segment identification	تحديد شريحة العملاء المستهدفة	\N	not_started	3	t	2026-03-01 13:59:53.130568	1.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
191	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.1	Market gap analysis	تحليل الفجوات في السوق	\N	not_started	4	t	2026-03-01 13:59:53.133951	1.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
192	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.1	Project positioning	تحديد تموضع المشروع	\N	not_started	5	t	2026-03-01 13:59:53.137351	1.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
193	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.1	Real estate cycle study	دراسة دورة السوق العقاري	\N	not_started	6	t	2026-03-01 13:59:53.14045	1.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
194	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.1	Highest & best use recommendations	توصيات الاستخدام الأعلى والأفضل	\N	not_started	7	t	2026-03-01 13:59:53.143695	1.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
195	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.2	Land plan & requirements review	مراجعة مخطط الأرض والاشتراطات	\N	not_started	0	t	2026-03-01 13:59:53.146784	1.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
196	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.2	GFA, BUA & sellable area definition	تحديد GFA و BUA والمساحات القابلة للبيع	\N	not_started	1	t	2026-03-01 13:59:53.150229	1.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
197	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.2	Site & accessibility study	دراسة الموقع والوصولية	\N	not_started	2	t	2026-03-01 13:59:53.152873	1.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
198	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.2	Height & density restrictions review	مراجعة قيود الارتفاع والكثافة	\N	not_started	3	t	2026-03-01 13:59:53.155882	1.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
199	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.2	Available infrastructure study	دراسة البنية التحتية المتاحة	\N	not_started	4	t	2026-03-01 13:59:53.158816	1.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
200	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.2	Site technical risk analysis	تحليل المخاطر الفنية للموقع	\N	not_started	5	t	2026-03-01 13:59:53.161546	1.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
201	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.2	Use alignment with planning code	مواءمة الاستخدام مع الكود التخطيطي	\N	not_started	6	t	2026-03-01 13:59:53.164979	1.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
202	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.2	Special technical requirements	تحديد المتطلبات الفنية الخاصة	\N	not_started	7	t	2026-03-01 13:59:53.167919	1.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
203	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.3	Land cost & fees estimation	تقدير تكلفة الأرض والرسوم	\N	not_started	0	t	2026-03-01 13:59:53.170867	1.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
204	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.3	Design & consultancy cost estimation	تقدير تكلفة التصميم والاستشارات	\N	not_started	1	t	2026-03-01 13:59:53.174295	1.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
205	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.3	Direct construction cost estimation	تقدير تكلفة الإنشاءات المباشرة	\N	not_started	2	t	2026-03-01 13:59:53.177372	1.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
206	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.3	Infrastructure & services cost estimation	تقدير تكلفة البنية التحتية والخدمات	\N	not_started	3	t	2026-03-01 13:59:53.180478	1.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
207	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.3	Marketing & sales cost estimation	تقدير تكلفة التسويق والبيع	\N	not_started	4	t	2026-03-01 13:59:53.19284	1.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
208	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.3	Operations & maintenance cost estimation	تقدير تكلفة التشغيل والصيانة إن وجدت	\N	not_started	5	t	2026-03-01 13:59:53.197096	1.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
209	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.3	Cash flow model preparation	إعداد نموذج التدفقات النقدية	\N	not_started	6	t	2026-03-01 13:59:53.200261	1.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
210	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.3	IRR, NPV & payback period calculation	احتساب مؤشرات IRR و NPV وفترة الاسترداد	\N	not_started	7	t	2026-03-01 13:59:53.203054	1.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
211	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.4	Real estate product type definition	تحديد نوع المنتج العقاري	\N	not_started	0	t	2026-03-01 13:59:53.206198	1.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
212	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.4	Project components & units definition	تحديد مكونات المشروع ووحداته	\N	not_started	1	t	2026-03-01 13:59:53.20939	1.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
213	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.4	Initial pricing policy	وضع سياسة التسعير المبدئية	\N	not_started	2	t	2026-03-01 13:59:53.211872	1.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
214	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.4	Buyer payment plan definition	تحديد خطة الدفع للمشترين	\N	not_started	3	t	2026-03-01 13:59:53.214372	1.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
215	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.4	Launch & sales strategy	تحديد استراتيجية الإطلاق والبيع	\N	not_started	4	t	2026-03-01 13:59:53.217144	1.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
216	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.4	Sales & marketing channels	تحديد قنوات البيع والتسويق	\N	not_started	5	t	2026-03-01 13:59:53.220007	1.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
217	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.4	Investment exit strategy	تحديد استراتيجية الخروج من الاستثمار	\N	not_started	6	t	2026-03-01 13:59:53.222775	1.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
218	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.4	Strategy alignment with feasibility results	مواءمة الاستراتيجية مع نتائج الجدوى	\N	not_started	7	t	2026-03-01 13:59:53.224807	1.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
219	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.5	Developer legal entity type selection	اختيار نوع الكيان القانوني للمطور	\N	not_started	0	t	2026-03-01 13:59:53.226893	1.5	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
220	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.5	Partners & shareholding ratios	تحديد الشركاء ونسب المساهمة	\N	not_started	1	t	2026-03-01 13:59:53.229522	1.5	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
221	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.5	Incorporation agreements preparation	إعداد عقود التأسيس والاتفاقيات	\N	not_started	2	t	2026-03-01 13:59:53.232554	1.5	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
222	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.5	Partnership model with land owner	تحديد نموذج الشراكة مع مالك الأرض	\N	not_started	3	t	2026-03-01 13:59:53.235235	1.5	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
223	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.5	Profit distribution mechanism	تحديد آلية توزيع الأرباح	\N	not_started	4	t	2026-03-01 13:59:53.237622	1.5	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
224	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.5	Parties' responsibilities & rights	تحديد مسؤوليات وحقوق الأطراف	\N	not_started	5	t	2026-03-01 13:59:53.240279	1.5	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
225	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.5	Internal governance framework	وضع إطار الحوكمة الداخلية	\N	not_started	6	t	2026-03-01 13:59:53.242888	1.5	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
226	e3a7e509-0b24-4d92-868d-4246f67edc78	foundation:1.5	Decision-making policy	تحديد سياسة اتخاذ القرار	\N	not_started	7	t	2026-03-01 13:59:53.245457	1.5	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
227	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.1	Complete company legal documents	استكمال مستندات الشركة القانونية	\N	not_started	0	t	2026-03-01 13:59:53.247496	2.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
228	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.1	Submit registration to regulatory body	تقديم طلب التسجيل لدى الجهة المنظمة	\N	not_started	1	t	2026-03-01 13:59:53.250094	2.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
229	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.1	Prove developer financial solvency	إثبات الملاءة المالية للمطور	\N	not_started	2	t	2026-03-01 13:59:53.253015	2.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
230	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.1	Register official contact details	تسجيل بيانات التواصل الرسمية	\N	not_started	3	t	2026-03-01 13:59:53.255657	2.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
231	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.1	Approve developer trade name	اعتماد اسم المطور التجاري	\N	not_started	4	t	2026-03-01 13:59:53.258084	2.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
232	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.1	Link developer to electronic systems	ربط المطور بالأنظمة الإلكترونية	\N	not_started	5	t	2026-03-01 13:59:53.260705	2.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
233	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.1	Update developer data as needed	تحديث بيانات المطور عند الحاجة	\N	not_started	6	t	2026-03-01 13:59:53.262806	2.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
234	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.1	Archive registration certificates & records	حفظ شهادات التسجيل والسجلات	\N	not_started	7	t	2026-03-01 13:59:53.265222	2.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
235	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.2	Prepare basic project data file	إعداد ملف بيانات المشروع الأساسية	\N	not_started	0	t	2026-03-01 13:59:53.267727	2.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
236	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.2	Define project type & components	تحديد نوع المشروع ومكوناته	\N	not_started	1	t	2026-03-01 13:59:53.271369	2.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
237	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.2	Submit electronic project registration	تقديم طلب تسجيل المشروع إلكترونياً	\N	not_started	2	t	2026-03-01 13:59:53.273742	2.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
238	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.2	Attach planning documents & permits	إرفاق المستندات التخطيطية والرخص	\N	not_started	3	t	2026-03-01 13:59:53.276535	2.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
239	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.2	Pay registration fees	دفع الرسوم المقررة للتسجيل	\N	not_started	4	t	2026-03-01 13:59:53.279619	2.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
240	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.2	Receive project reference number	استلام رقم المشروع المرجعي	\N	not_started	5	t	2026-03-01 13:59:53.283342	2.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
241	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.2	Link project to escrow account	ربط المشروع بحساب الضمان	\N	not_started	6	t	2026-03-01 13:59:53.286177	2.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
242	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.2	Update project data on amendments	تحديث بيانات المشروع عند التعديل	\N	not_started	7	t	2026-03-01 13:59:53.288368	2.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
243	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.3	Select approved trustee bank	اختيار بنك أمين حساب معتمد	\N	not_started	0	t	2026-03-01 13:59:53.290491	2.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
244	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.3	Prepare company & project documents	تجهيز مستندات الشركة والمشروع	\N	not_started	1	t	2026-03-01 13:59:53.293259	2.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
245	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.3	Sign escrow agreement with bank	توقيع اتفاقية حساب الضمان مع البنك	\N	not_started	2	t	2026-03-01 13:59:53.295246	2.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
246	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.3	Define withdrawal & deposit conditions	تحديد شروط السحب والإيداع	\N	not_started	3	t	2026-03-01 13:59:53.297694	2.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
247	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.3	Link project number to escrow account	ربط المشروع ورقمه بحساب الضمان	\N	not_started	4	t	2026-03-01 13:59:53.299976	2.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
248	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.3	Define authorized signatories	تعريف أطراف الصلاحية على الحساب	\N	not_started	5	t	2026-03-01 13:59:53.302362	2.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
249	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.3	Approve payment schedule with bank	اعتماد خطة الدفعات مع البنك	\N	not_started	6	t	2026-03-01 13:59:53.305076	2.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
250	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.3	Activate account for buyer deposits	تفعيل الحساب لاستقبال أموال المشترين	\N	not_started	7	t	2026-03-01 13:59:53.307506	2.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
251	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.4	Review applicable real estate laws	مراجعة القوانين العقارية السارية	\N	not_started	0	t	2026-03-01 13:59:53.309574	2.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
252	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.4	Align sales contracts with requirements	مواءمة عقود البيع مع المتطلبات	\N	not_started	1	t	2026-03-01 13:59:53.312798	2.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
253	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.4	Comply with advertising regulations	الالتزام بضوابط الإعلانات العقارية	\N	not_started	2	t	2026-03-01 13:59:53.315401	2.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
254	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.4	Comply with off-plan sales conditions	الالتزام بشروط البيع على الخارطة	\N	not_started	3	t	2026-03-01 13:59:53.318047	2.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
255	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.4	Prepare internal compliance policies	إعداد سياسات داخلية للامتثال	\N	not_started	4	t	2026-03-01 13:59:53.320777	2.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
256	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.4	Keep updated copies of regulations	حفظ نسخ محدثة من اللوائح	\N	not_started	5	t	2026-03-01 13:59:53.323334	2.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
257	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.4	Train team on regulatory requirements	تدريب الفريق على المتطلبات النظامية	\N	not_started	6	t	2026-03-01 13:59:53.325792	2.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
258	e3a7e509-0b24-4d92-868d-4246f67edc78	legal:2.4	Monitor periodic regulatory changes	مراقبة التغييرات التنظيمية الدورية	\N	not_started	7	t	2026-03-01 13:59:53.328547	2.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
259	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.1	Select lead architectural consultant	اختيار الاستشاري المعماري الرئيسي	\N	not_started	0	t	2026-03-01 13:59:53.331201	3.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
260	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.1	Appoint structural, MEP consultants	تعيين استشاريي الإنشاءات والميكانيكا والكهرباء	\N	not_started	1	t	2026-03-01 13:59:53.333896	3.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
261	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.1	Appoint traffic, facade & landscape consultants	تعيين استشاري المرور والواجهات والمناظر الطبيعية	\N	not_started	2	t	2026-03-01 13:59:53.335912	3.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
262	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.1	Appoint quantity surveyor & cost consultant	تعيين استشاري الكميات والتكلفة	\N	not_started	3	t	2026-03-01 13:59:53.337954	3.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
263	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.1	Define scope of work per consultant	تحديد نطاق عمل كل استشاري	\N	not_started	4	t	2026-03-01 13:59:53.340063	3.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
264	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.1	Sign technical consultancy contracts	توقيع عقود الاستشارات الفنية	\N	not_started	5	t	2026-03-01 13:59:53.343853	3.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
265	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.1	Define inter-consultant coordination mechanism	تحديد آلية التنسيق بين الاستشاريين	\N	not_started	6	t	2026-03-01 13:59:53.346525	3.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
266	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.1	Set design schedule	وضع جدول زمني للتصميمات	\N	not_started	7	t	2026-03-01 13:59:53.348951	3.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
267	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.2	Prepare concept design & massing	إعداد التصور المبدئي والكتل	\N	not_started	0	t	2026-03-01 13:59:53.351375	3.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
268	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.2	Prepare preliminary architectural plans	إعداد المخطط المعماري المبدئي	\N	not_started	1	t	2026-03-01 13:59:53.354144	3.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
269	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.2	Develop detailed design drawings	تطوير التصميم إلى مخطط تفصيلي	\N	not_started	2	t	2026-03-01 13:59:53.356406	3.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
270	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.2	Coordinate architectural, structural & MEP	التنسيق بين المعماري والإنشائي والميكانيكي	\N	not_started	3	t	2026-03-01 13:59:53.358291	3.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
271	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.2	Code & requirements review during design	مراجعة الكود والاشتراطات خلال التصميم	\N	not_started	4	t	2026-03-01 13:59:53.360374	3.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
272	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.2	Prepare authority submission drawings	إعداد المخططات الصادرة للجهات	\N	not_started	5	t	2026-03-01 13:59:53.362834	3.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
273	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.2	Prepare tender drawings	إعداد المخططات الصادرة للمناقصة	\N	not_started	6	t	2026-03-01 13:59:53.364951	3.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
274	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.2	Update designs per authority comments	تحديث التصاميم بناءً على ملاحظات الجهات	\N	not_started	7	t	2026-03-01 13:59:53.367431	3.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
275	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.3	Obtain land plan & affection plan	استخراج مخطط الأرض والـ Affection Plan	\N	not_started	0	t	2026-03-01 13:59:53.369942	3.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
276	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.3	Submit plans to municipality	تقديم المخططات للبلدية أو الجهة المختصة	\N	not_started	1	t	2026-03-01 13:59:53.372415	3.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
277	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.3	Obtain electricity & water NOC	الحصول على عدم ممانعة الكهرباء والمياه	\N	not_started	2	t	2026-03-01 13:59:53.374996	3.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
278	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.3	Obtain roads & access NOC	الحصول على عدم ممانعة الطرق والمداخل	\N	not_started	3	t	2026-03-01 13:59:53.377007	3.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
279	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.3	Obtain civil defense NOC	الحصول على عدم ممانعة الدفاع المدني	\N	not_started	4	t	2026-03-01 13:59:53.379411	3.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
280	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.3	Obtain telecom & other utilities NOC	الحصول على عدم ممانعة الاتصالات والبنى الأخرى	\N	not_started	5	t	2026-03-01 13:59:53.382122	3.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
281	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.3	Complete comments until final approval	استكمال الملاحظات حتى الموافقة النهائية	\N	not_started	6	t	2026-03-01 13:59:53.384389	3.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
282	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.3	Document all approvals in project file	توثيق جميع الموافقات في ملف المشروع	\N	not_started	7	t	2026-03-01 13:59:53.387806	3.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
283	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.4	Submit building permit with approved plans	تقديم طلب رخصة البناء بالمخططات المعتمدة	\N	not_started	0	t	2026-03-01 13:59:53.390259	3.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
284	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.4	Pay building permit fees	سداد رسوم رخصة البناء	\N	not_started	1	t	2026-03-01 13:59:53.393	3.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
285	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.4	Complete technical & legal requirements	استكمال المتطلبات الفنية والقانونية	\N	not_started	2	t	2026-03-01 13:59:53.395368	3.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
286	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.4	Receive final building permit	استلام رخصة البناء النهائية	\N	not_started	3	t	2026-03-01 13:59:53.397589	3.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
287	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.4	Obtain site preparation permits	استخراج تصاريح تجهيز الموقع	\N	not_started	4	t	2026-03-01 13:59:53.399999	3.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
288	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.4	Obtain signage & hoarding permits	استخراج تصاريح اللوحات والحواجز المؤقتة	\N	not_started	5	t	2026-03-01 13:59:53.402648	3.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
289	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.4	Share permit data with consultant & contractor	مشاركة بيانات الرخصة مع الاستشاري والمقاول	\N	not_started	6	t	2026-03-01 13:59:53.404847	3.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
290	e3a7e509-0b24-4d92-868d-4246f67edc78	design:3.4	Archive permit documents in project records	حفظ وثائق الرخصة ضمن سجلات المشروع	\N	not_started	7	t	2026-03-01 13:59:53.407241	3.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
291	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.1	Prepare project financing file	إعداد ملف تمويلي للمشروع	\N	not_started	0	t	2026-03-01 13:59:53.409741	4.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
292	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.1	Negotiate financing terms with banks	التفاوض مع البنوك على شروط التمويل	\N	not_started	1	t	2026-03-01 13:59:53.412082	4.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
293	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.1	Agree on financing amounts & drawdown schedule	الاتفاق على مبالغ التمويل وجدول السحب	\N	not_started	2	t	2026-03-01 13:59:53.414524	4.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
294	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.1	Pledge assets or provide guarantees	رهن الأصول أو تقديم الضمانات المطلوبة	\N	not_started	3	t	2026-03-01 13:59:53.417259	4.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
295	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.1	Sign final financing agreements	توقيع اتفاقيات التمويل النهائية	\N	not_started	4	t	2026-03-01 13:59:53.419847	4.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
296	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.1	Link drawdown schedules to work progress	ربط جداول السحب بتقدم الأعمال	\N	not_started	5	t	2026-03-01 13:59:53.422441	4.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
297	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.1	Link financing to escrow account	ربط التمويل بحساب الضمان	\N	not_started	6	t	2026-03-01 13:59:53.425489	4.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
298	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.1	Monitor compliance with financier covenants	متابعة شروط الالتزام مع الممولين	\N	not_started	7	t	2026-03-01 13:59:53.428361	4.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
299	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.2	Develop project visual identity	تطوير الهوية البصرية للمشروع	\N	not_started	0	t	2026-03-01 13:59:53.430515	4.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
300	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.2	Prepare brochures & printed materials	إعداد البروشورات والمواد المطبوعة	\N	not_started	1	t	2026-03-01 13:59:53.433385	4.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
301	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.2	Prepare 3D renders & visual presentations	إعداد التصوير ثلاثي الأبعاد والعروض المرئية	\N	not_started	2	t	2026-03-01 13:59:53.436225	4.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
302	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.2	Build project website	تجهيز الموقع الإلكتروني للمشروع	\N	not_started	3	t	2026-03-01 13:59:53.438865	4.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
303	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.2	Prepare unit & floor plans for sales	إعداد مخططات الشقق والأدوار للبيع	\N	not_started	4	t	2026-03-01 13:59:53.44205	4.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
304	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.2	Prepare price lists & payment plans	إعداد جداول الأسعار وخطط السداد	\N	not_started	5	t	2026-03-01 13:59:53.447162	4.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
305	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.2	Prepare sales office display materials	إعداد مواد العرض لمكاتب البيع	\N	not_started	6	t	2026-03-01 13:59:53.44962	4.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
306	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.2	Prepare social media content	تجهيز محتوى منصات التواصل الاجتماعي	\N	not_started	7	t	2026-03-01 13:59:53.452037	4.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
307	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.3	Submit advertising permit applications	تقديم طلبات تصاريح الإعلانات للجهة المختصة	\N	not_started	0	t	2026-03-01 13:59:53.454237	4.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
308	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.3	Enter project & escrow data in permit	إدخال بيانات المشروع وحساب الضمان في التصريح	\N	not_started	1	t	2026-03-01 13:59:53.457337	4.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
309	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.3	Obtain QR codes or required codes	الحصول على رموز الاستجابة أو الأكواد المطلوبة	\N	not_started	2	t	2026-03-01 13:59:53.459459	4.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
310	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.3	Include permit data in all advertisements	إدراج بيانات التصريح في جميع الإعلانات	\N	not_started	3	t	2026-03-01 13:59:53.462506	4.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
311	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.3	Comply with approved advertising terms	الالتزام بنصوص وشروط الإعلانات المعتمدة	\N	not_started	4	t	2026-03-01 13:59:53.464729	4.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
312	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.3	Monitor marketing materials for compliance	مراقبة المواد التسويقية للامتثال	\N	not_started	5	t	2026-03-01 13:59:53.468011	4.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
313	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.3	Renew advertising permits as needed	تجديد تصاريح الإعلانات عند الحاجة	\N	not_started	6	t	2026-03-01 13:59:53.470663	4.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
314	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.3	Archive all advertising permits	حفظ نسخ من جميع التصاريح الإعلانية	\N	not_started	7	t	2026-03-01 13:59:53.472882	4.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
315	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.4	Prepare booking forms & purchase applications	إعداد نماذج الحجز وطلبات الشراء	\N	not_started	0	t	2026-03-01 13:59:53.475191	4.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
316	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.4	Prepare sale & purchase agreement draft	إعداد مسودة عقد البيع والشراء	\N	not_started	1	t	2026-03-01 13:59:53.477584	4.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
317	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.4	Contract licensed real estate brokers	التعاقد مع الوسطاء العقاريين المرخصين	\N	not_started	2	t	2026-03-01 13:59:53.479844	4.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
318	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.4	Receive & document reservations	استقبال الحجوزات وتوثيقها	\N	not_started	3	t	2026-03-01 13:59:53.482218	4.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
319	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.4	Sign sales contracts with buyers	توقيع عقود البيع مع المشترين	\N	not_started	4	t	2026-03-01 13:59:53.48437	4.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
320	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.4	Collect payments in escrow account only	تحصيل الدفعات في حساب الضمان فقط	\N	not_started	5	t	2026-03-01 13:59:53.486704	4.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
321	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.4	Register sales in real estate system	تسجيل عمليات البيع في النظام العقاري	\N	not_started	6	t	2026-03-01 13:59:53.489211	4.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
322	e3a7e509-0b24-4d92-868d-4246f67edc78	financing:4.4	Monitor buyer payment schedule compliance	متابعة التزام المشترين بجداول السداد	\N	not_started	7	t	2026-03-01 13:59:53.491547	4.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
323	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.1	Prepare main contractor tender documents	إعداد وثائق المناقصة للمقاول الرئيسي	\N	not_started	0	t	2026-03-01 13:59:53.493955	5.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
324	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.1	Prepare qualified contractors shortlist	إعداد قائمة المقاولين المؤهلين	\N	not_started	1	t	2026-03-01 13:59:53.496705	5.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
325	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.1	Send invitations & receive bids	إرسال الدعوات واستلام العطاءات	\N	not_started	2	t	2026-03-01 13:59:53.499142	5.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
326	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.1	Organize site visits for contractors	تنظيم زيارات الموقع للمقاولين	\N	not_started	3	t	2026-03-01 13:59:53.50145	5.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
327	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.1	Respond to contractor queries	الرد على استفسارات المقاولين	\N	not_started	4	t	2026-03-01 13:59:53.50402	5.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
328	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.1	Technical & financial bid comparison	مقارنة العطاءات فنياً ومالياً	\N	not_started	5	t	2026-03-01 13:59:53.506955	5.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
329	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.1	Select preferred contractor	اختيار المقاول المفضل	\N	not_started	6	t	2026-03-01 13:59:53.509247	5.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
330	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.1	Submit award recommendation	رفع التوصية لاعتماد الترسية	\N	not_started	7	t	2026-03-01 13:59:53.511884	5.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
331	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.2	Negotiate final price & payment terms	التفاوض على السعر النهائي وشروط الدفع	\N	not_started	0	t	2026-03-01 13:59:53.513825	5.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
332	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.2	Agree on contract program schedule	الاتفاق على البرنامج الزمني للعقد	\N	not_started	1	t	2026-03-01 13:59:53.516859	5.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
333	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.2	Agree on quality & defects liability terms	الاتفاق على شروط الجودة وضمان العيوب	\N	not_started	2	t	2026-03-01 13:59:53.519273	5.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
334	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.2	Sign building contract with main contractor	توقيع عقد البناء مع المقاول الرئيسي	\N	not_started	3	t	2026-03-01 13:59:53.521663	5.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
335	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.2	Notify consultants of contract	إشعار الاستشاريين بالتعاقد	\N	not_started	4	t	2026-03-01 13:59:53.524383	5.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
336	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.2	Send contract copy to financiers	إرسال نسخة العقد للجهات الممولة	\N	not_started	5	t	2026-03-01 13:59:53.52689	5.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
337	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.2	Update project plan based on contract	تحديث خطة المشروع بناءً على العقد	\N	not_started	6	t	2026-03-01 13:59:53.529194	5.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
338	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.2	Issue commencement orders to contractor	إصدار أوامر المباشرة للمقاول	\N	not_started	7	t	2026-03-01 13:59:53.53138	5.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
339	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.3	Contractor site mobilization	تجهيز الموقع من قبل المقاول	\N	not_started	0	t	2026-03-01 13:59:53.533129	5.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
340	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.3	Hold periodic progress meetings	عقد اجتماعات تقدم الأعمال الدورية	\N	not_started	1	t	2026-03-01 13:59:53.535483	5.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
341	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.3	Review updated programs	مراجعة البرامج الزمنية المحدثة	\N	not_started	2	t	2026-03-01 13:59:53.537614	5.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
342	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.3	Approve materials & key suppliers	اعتماد المواد والموردين الرئيسيين	\N	not_started	3	t	2026-03-01 13:59:53.540007	5.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
343	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.3	Review & approve shop drawings	مراجعة واعتماد مخططات الورشة	\N	not_started	4	t	2026-03-01 13:59:53.54296	5.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
344	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.3	Manage variation orders & claims	إدارة أوامر التغيير والمطالبات	\N	not_started	5	t	2026-03-01 13:59:53.545675	5.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
345	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.3	Monitor contractor safety compliance	متابعة التزام المقاول بالسلامة	\N	not_started	6	t	2026-03-01 13:59:53.548147	5.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
346	e3a7e509-0b24-4d92-868d-4246f67edc78	execution:5.3	Document progress with photos & reports	توثيق تقدم الأعمال بالصور والتقارير	\N	not_started	7	t	2026-03-01 13:59:53.550275	5.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
347	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.1	Complete final finishing works	استكمال أعمال التشطيبات النهائية	\N	not_started	0	t	2026-03-01 13:59:53.552478	6.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
348	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.1	Perform electrical & mechanical system tests	تنفيذ اختبارات أنظمة الكهرباء والميكانيك	\N	not_started	1	t	2026-03-01 13:59:53.554932	6.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
349	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.1	Perform fire & safety system tests	تنفيذ اختبارات أنظمة الحريق والسلامة	\N	not_started	2	t	2026-03-01 13:59:53.556892	6.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
350	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.1	Address test result findings	معالجة الملاحظات الناتجة عن الاختبارات	\N	not_started	3	t	2026-03-01 13:59:53.559199	6.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
351	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.1	Prepare common areas & facilities	تجهيز المواقع المشتركة والمرافق	\N	not_started	4	t	2026-03-01 13:59:53.561463	6.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
352	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.1	Internal cleaning & unit preparation	تنظيف وتسليم الوحدات داخلياً	\N	not_started	5	t	2026-03-01 13:59:53.563935	6.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
353	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.1	Prepare building system files	تجهيز ملفات أنظمة المبنى	\N	not_started	6	t	2026-03-01 13:59:53.5662	6.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
354	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.1	Prepare final internal snagging list	إعداد قائمة الملاحظات الداخلية النهائية	\N	not_started	7	t	2026-03-01 13:59:53.56849	6.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
355	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.2	Coordinate official authority site visits	تنسيق زيارات الجهات الرسمية للموقع	\N	not_started	0	t	2026-03-01 13:59:53.570722	6.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
356	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.2	Complete municipality & authority comments	استكمال ملاحظات البلدية والجهات الأخرى	\N	not_started	1	t	2026-03-01 13:59:53.573359	6.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
357	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.2	Submit building completion certificate request	تقديم طلب شهادة إنجاز المبنى	\N	not_started	2	t	2026-03-01 13:59:53.576171	6.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
358	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.2	Receive final completion certificate	استلام شهادة الإنجاز النهائية	\N	not_started	3	t	2026-03-01 13:59:53.578529	6.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
359	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.2	Share certificate with relevant parties	مشاركة الشهادة مع الجهات المعنية	\N	not_started	4	t	2026-03-01 13:59:53.581093	6.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
360	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.2	Update project data in records	تحديث بيانات المشروع في السجلات	\N	not_started	5	t	2026-03-01 13:59:53.583948	6.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
393	905c5323-dcbd-4eeb-b944-acd6d4f6a037	construction	MEP Rough-in	تمديدات MEP	\N	not_started	6	t	2026-03-01 23:21:36.104308	C06	MEP systems	contractor	2025-10-01	2026-06-01	f	0.00	0.00	أعمال MEP	\N	\N	\N
361	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.2	Notify financiers & buyers of completion	إشعار الممولين والمشترين بإنجاز المشروع	\N	not_started	6	t	2026-03-01 13:59:53.586264	6.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
362	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.2	Archive all completion documents	أرشفة جميع وثائق الإنهاء	\N	not_started	7	t	2026-03-01 13:59:53.589146	6.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
363	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.3	Invite buyers for inspection & handover	دعوة المشترين لزيارات الفحص والاستلام	\N	not_started	0	t	2026-03-01 13:59:53.59131	6.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
364	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.3	Document snags per unit individually	توثيق الملاحظات لكل وحدة على حدة	\N	not_started	1	t	2026-03-01 13:59:53.593803	6.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
365	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.3	Address snags before final handover	معالجة الملاحظات قبل التسليم النهائي	\N	not_started	2	t	2026-03-01 13:59:53.596127	6.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
366	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.3	Sign unit handover certificates with owners	توقيع محاضر استلام الوحدات مع الملاك	\N	not_started	3	t	2026-03-01 13:59:53.598501	6.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
367	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.3	Activate contract warranty periods	تفعيل فترات الضمان المحددة في العقود	\N	not_started	4	t	2026-03-01 13:59:53.60108	6.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
368	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.3	Receive & address warranty defect reports	استقبال ومعالجة بلاغات العيوب خلال الضمان	\N	not_started	5	t	2026-03-01 13:59:53.603726	6.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
369	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.3	Hand over unit files & keys to owners	تسليم ملفات الوحدات والمفاتيح للملاك	\N	not_started	6	t	2026-03-01 13:59:53.605742	6.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
370	e3a7e509-0b24-4d92-868d-4246f67edc78	handover:6.3	Transfer project to facility management or HOA	نقل بيانات المشروع إلى إدارة المرافق أو جمعية الملاك	\N	not_started	7	t	2026-03-01 13:59:53.608094	6.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
371	905c5323-dcbd-4eeb-b944-acd6d4f6a037	legal	Land Acquisition	شراء الأرض	\N	completed	1	t	2026-03-01 23:21:36.104308	L01	Purchase plot 6185392	owner	2024-09-01	2024-10-15	f	18000000.00	0.00	شراء القطعة 6185392	\N	\N	\N
372	905c5323-dcbd-4eeb-b944-acd6d4f6a037	legal	DLD Title Registration	تسجيل سند الملكية	\N	completed	2	t	2026-03-01 23:21:36.104308	L02	DLD registration	owner	2024-10-15	2024-11-01	f	720000.00	0.00	تسجيل لدى دائرة الأراضي	\N	\N	\N
373	905c5323-dcbd-4eeb-b944-acd6d4f6a037	legal	RERA Developer Registration	تسجيل المطور RERA	\N	completed	3	t	2026-03-01 23:21:36.104308	L03	Register COMO	owner	2024-11-01	2024-12-15	f	0.00	0.00	تسجيل كومو مطور عقاري	\N	\N	\N
374	905c5323-dcbd-4eeb-b944-acd6d4f6a037	legal	Master Developer NOC	عدم ممانعة المطور الرئيسي	\N	completed	4	t	2026-03-01 23:21:36.104308	L04	Shamal Estates NOC	owner	2024-11-15	2024-12-01	f	0.00	0.00	عدم ممانعة شمال العقارية	\N	\N	\N
375	905c5323-dcbd-4eeb-b944-acd6d4f6a037	design	Concept Design	التصميم المبدئي	\N	completed	1	t	2026-03-01 23:21:36.104308	D01	Architectural concept G+7	consultant	2024-11-01	2024-12-15	f	0.00	0.00	التصميم المعماري المبدئي	\N	\N	\N
376	905c5323-dcbd-4eeb-b944-acd6d4f6a037	design	Detailed Design	التصميم التفصيلي	\N	completed	2	t	2026-03-01 23:21:36.104308	D02	Working drawings	consultant	2024-12-15	2025-01-15	f	473136.00	0.00	رسومات تنفيذية	\N	\N	\N
377	905c5323-dcbd-4eeb-b944-acd6d4f6a037	design	QS Cost Estimation	تقدير التكاليف	\N	completed	3	t	2026-03-01 23:21:36.104308	D03	BOQ by QS	consultant	2025-01-01	2025-01-15	f	0.00	0.00	جدول كميات	\N	\N	\N
378	905c5323-dcbd-4eeb-b944-acd6d4f6a037	design	Soil Investigation	فحص التربة	\N	completed	4	t	2026-03-01 23:21:36.104308	D04	Geotechnical report	consultant	2024-11-01	2024-11-20	f	25000.00	0.00	تقرير جيوتقني	\N	\N	\N
379	905c5323-dcbd-4eeb-b944-acd6d4f6a037	permits	Municipality Planning	موافقة تخطيط البلدية	\N	completed	1	t	2026-03-01 23:21:36.104308	P01	DM planning	system	2025-01-10	2025-02-01	f	500000.00	0.00	موافقة تخطيط	\N	\N	\N
380	905c5323-dcbd-4eeb-b944-acd6d4f6a037	permits	Building Permit	رخصة البناء	\N	completed	2	t	2026-03-01 23:21:36.104308	P02	Construction permit	system	2025-02-01	2025-02-25	f	0.00	0.00	رخصة بناء	\N	\N	\N
381	905c5323-dcbd-4eeb-b944-acd6d4f6a037	permits	DEWA NOC	عدم ممانعة ديوا	\N	completed	3	t	2026-03-01 23:21:36.104308	P03	DEWA clearance	system	2025-01-15	2025-02-10	f	0.00	0.00	موافقة ديوا	\N	\N	\N
382	905c5323-dcbd-4eeb-b944-acd6d4f6a037	permits	Civil Defense	الدفاع المدني	\N	in_progress	4	t	2026-03-01 23:21:36.104308	P04	Fire safety submitted	consultant	2025-02-15	2025-07-01	f	0.00	0.00	مخططات سلامة مقدمة	\N	\N	\N
383	905c5323-dcbd-4eeb-b944-acd6d4f6a037	permits	RERA Project Registration	تسجيل المشروع RERA	\N	completed	5	t	2026-03-01 23:21:36.104308	P05	Project registration	owner	2025-02-15	2025-03-01	f	207100.00	0.00	تسجيل المشروع	\N	\N	\N
384	905c5323-dcbd-4eeb-b944-acd6d4f6a037	permits	Escrow Account Opening	فتح حساب الإسكرو	\N	completed	6	t	2026-03-01 23:21:36.104308	P06	Open escrow ENBD	owner	2025-02-20	2025-03-01	f	140000.00	0.00	حساب إسكرو	\N	\N	\N
385	905c5323-dcbd-4eeb-b944-acd6d4f6a037	tendering	Tender Preparation	إعداد المناقصة	\N	completed	1	t	2026-03-01 23:21:36.104308	T01	Tender docs & BOQ	consultant	2025-01-20	2025-01-30	f	0.00	0.00	وثائق المناقصة	\N	\N	\N
386	905c5323-dcbd-4eeb-b944-acd6d4f6a037	tendering	Tender Evaluation	تقييم العروض	\N	completed	2	t	2026-03-01 23:21:36.104308	T02	Evaluate 4 bids	owner	2025-02-01	2025-02-15	f	0.00	0.00	تقييم 4 عروض	\N	\N	\N
387	905c5323-dcbd-4eeb-b944-acd6d4f6a037	tendering	Contract Award	ترسية العقد	\N	completed	3	t	2026-03-01 23:21:36.104308	T03	Award to Al Rashid	owner	2025-02-15	2025-02-20	f	0.00	0.00	ترسية — الراشد	\N	\N	\N
388	905c5323-dcbd-4eeb-b944-acd6d4f6a037	construction	Site Mobilization	تعبئة الموقع	\N	completed	1	t	2026-03-01 23:21:36.104308	C01	Contractor mobilization	contractor	2025-03-01	2025-03-15	f	0.00	0.00	تعبئة المقاول	\N	\N	\N
389	905c5323-dcbd-4eeb-b944-acd6d4f6a037	construction	Excavation & Shoring	أعمال الحفر والتدعيم	\N	completed	2	t	2026-03-01 23:21:36.104308	C02	Excavation to foundation	contractor	2025-03-15	2025-04-15	f	1800000.00	0.00	حفر الأساسات	\N	\N	\N
390	905c5323-dcbd-4eeb-b944-acd6d4f6a037	construction	Foundation Concrete	خرسانة الأساسات	\N	in_progress	3	t	2026-03-01 23:21:36.104308	C03	Foundation raft & piling	contractor	2025-04-15	2025-06-30	f	1465789.00	0.00	صب أساسات وخوازيق	\N	\N	\N
391	905c5323-dcbd-4eeb-b944-acd6d4f6a037	construction	Substructure	الهيكل السفلي	\N	not_started	4	t	2026-03-01 23:21:36.104308	C04	Basement structure	contractor	2025-06-01	2025-08-01	f	0.00	0.00	هيكل القبو	\N	\N	\N
392	905c5323-dcbd-4eeb-b944-acd6d4f6a037	construction	Superstructure	الهيكل العلوي	\N	not_started	5	t	2026-03-01 23:21:36.104308	C05	Floors 1-7	contractor	2025-08-01	2026-02-01	f	0.00	0.00	الطوابق 1-7	\N	\N	\N
394	905c5323-dcbd-4eeb-b944-acd6d4f6a037	construction	Internal Finishing	التشطيبات الداخلية	\N	not_started	7	t	2026-03-01 23:21:36.104308	C07	Plastering, tiling, painting	contractor	2026-02-01	2026-10-01	f	0.00	0.00	لياسة وبلاط ودهانات	\N	\N	\N
395	905c5323-dcbd-4eeb-b944-acd6d4f6a037	construction	External Works	أعمال خارجية	\N	not_started	8	t	2026-03-01 23:21:36.104308	C08	Facade, landscape	contractor	2026-06-01	2026-12-01	f	0.00	0.00	واجهات وتنسيق	\N	\N	\N
396	905c5323-dcbd-4eeb-b944-acd6d4f6a037	handover	Completion Certificate	شهادة إنجاز	\N	not_started	1	t	2026-03-01 23:21:36.104308	H01	Authority certificate	system	2027-01-01	2027-02-01	f	0.00	0.00	شهادة من الجهات	\N	\N	\N
397	905c5323-dcbd-4eeb-b944-acd6d4f6a037	handover	Unit Snagging	فحص الوحدات	\N	not_started	2	t	2026-03-01 23:21:36.104308	H02	Inspect 48 units	consultant	2027-02-01	2027-03-01	f	0.00	0.00	فحص 48 وحدة	\N	\N	\N
398	905c5323-dcbd-4eeb-b944-acd6d4f6a037	handover	Title Deed Issuance	إصدار سندات الملكية	\N	not_started	3	t	2026-03-01 23:21:36.104308	H03	Unit title deeds	owner	2027-03-01	2027-04-01	f	0.00	0.00	سندات ملكية	\N	\N	\N
399	905c5323-dcbd-4eeb-b944-acd6d4f6a037	handover	OA Transfer	نقل لجمعية الملاك	\N	not_started	4	t	2026-03-01 23:21:36.104308	H04	Owners Association	owner	2027-04-01	2027-06-01	f	0.00	0.00	جمعية الملاك	\N	\N	\N
400	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.1	Supply & demand analysis	تحليل العرض والطلب	\N	not_started	0	t	2026-03-02 15:43:26.344225	1.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
401	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.1	Price & rental analysis	تحليل الأسعار والإيجارات	\N	not_started	1	t	2026-03-02 15:43:26.489433	1.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
402	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.1	Competing projects study	دراسة المشاريع المنافسة	\N	not_started	2	t	2026-03-02 15:43:26.493532	1.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
403	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.1	Target customer segment identification	تحديد شريحة العملاء المستهدفة	\N	not_started	3	t	2026-03-02 15:43:26.497509	1.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
404	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.1	Market gap analysis	تحليل الفجوات في السوق	\N	not_started	4	t	2026-03-02 15:43:26.510615	1.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
405	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.1	Project positioning	تحديد تموضع المشروع	\N	not_started	5	t	2026-03-02 15:43:26.514697	1.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
406	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.1	Real estate cycle study	دراسة دورة السوق العقاري	\N	not_started	6	t	2026-03-02 15:43:26.51895	1.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
407	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.1	Highest & best use recommendations	توصيات الاستخدام الأعلى والأفضل	\N	not_started	7	t	2026-03-02 15:43:26.523032	1.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
408	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.2	Land plan & requirements review	مراجعة مخطط الأرض والاشتراطات	\N	not_started	0	t	2026-03-02 15:43:26.52714	1.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
409	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.2	GFA, BUA & sellable area definition	تحديد GFA و BUA والمساحات القابلة للبيع	\N	not_started	1	t	2026-03-02 15:43:26.531135	1.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
410	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.2	Site & accessibility study	دراسة الموقع والوصولية	\N	not_started	2	t	2026-03-02 15:43:26.534997	1.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
411	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.2	Height & density restrictions review	مراجعة قيود الارتفاع والكثافة	\N	not_started	3	t	2026-03-02 15:43:26.539082	1.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
412	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.2	Available infrastructure study	دراسة البنية التحتية المتاحة	\N	not_started	4	t	2026-03-02 15:43:26.543205	1.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
413	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.2	Site technical risk analysis	تحليل المخاطر الفنية للموقع	\N	not_started	5	t	2026-03-02 15:43:26.547288	1.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
414	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.2	Use alignment with planning code	مواءمة الاستخدام مع الكود التخطيطي	\N	not_started	6	t	2026-03-02 15:43:26.551832	1.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
415	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.2	Special technical requirements	تحديد المتطلبات الفنية الخاصة	\N	not_started	7	t	2026-03-02 15:43:26.556035	1.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
416	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.3	Land cost & fees estimation	تقدير تكلفة الأرض والرسوم	\N	not_started	0	t	2026-03-02 15:43:26.559481	1.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
417	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.3	Design & consultancy cost estimation	تقدير تكلفة التصميم والاستشارات	\N	not_started	1	t	2026-03-02 15:43:26.563511	1.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
418	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.3	Direct construction cost estimation	تقدير تكلفة الإنشاءات المباشرة	\N	not_started	2	t	2026-03-02 15:43:26.56694	1.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
419	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.3	Infrastructure & services cost estimation	تقدير تكلفة البنية التحتية والخدمات	\N	not_started	3	t	2026-03-02 15:43:26.570836	1.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
420	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.3	Marketing & sales cost estimation	تقدير تكلفة التسويق والبيع	\N	not_started	4	t	2026-03-02 15:43:26.574843	1.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
421	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.3	Operations & maintenance cost estimation	تقدير تكلفة التشغيل والصيانة إن وجدت	\N	not_started	5	t	2026-03-02 15:43:26.578285	1.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
422	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.3	Cash flow model preparation	إعداد نموذج التدفقات النقدية	\N	not_started	6	t	2026-03-02 15:43:26.58125	1.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
423	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.3	IRR, NPV & payback period calculation	احتساب مؤشرات IRR و NPV وفترة الاسترداد	\N	not_started	7	t	2026-03-02 15:43:26.584595	1.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
424	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.4	Real estate product type definition	تحديد نوع المنتج العقاري	\N	not_started	0	t	2026-03-02 15:43:26.588145	1.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
425	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.4	Project components & units definition	تحديد مكونات المشروع ووحداته	\N	not_started	1	t	2026-03-02 15:43:26.592654	1.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
426	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.4	Initial pricing policy	وضع سياسة التسعير المبدئية	\N	not_started	2	t	2026-03-02 15:43:26.596658	1.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
427	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.4	Buyer payment plan definition	تحديد خطة الدفع للمشترين	\N	not_started	3	t	2026-03-02 15:43:26.600247	1.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
428	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.4	Launch & sales strategy	تحديد استراتيجية الإطلاق والبيع	\N	not_started	4	t	2026-03-02 15:43:26.603796	1.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
429	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.4	Sales & marketing channels	تحديد قنوات البيع والتسويق	\N	not_started	5	t	2026-03-02 15:43:26.607902	1.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
430	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.4	Investment exit strategy	تحديد استراتيجية الخروج من الاستثمار	\N	not_started	6	t	2026-03-02 15:43:26.61177	1.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
431	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.4	Strategy alignment with feasibility results	مواءمة الاستراتيجية مع نتائج الجدوى	\N	not_started	7	t	2026-03-02 15:43:26.616045	1.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
432	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.5	Developer legal entity type selection	اختيار نوع الكيان القانوني للمطور	\N	not_started	0	t	2026-03-02 15:43:26.620279	1.5	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
433	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.5	Partners & shareholding ratios	تحديد الشركاء ونسب المساهمة	\N	not_started	1	t	2026-03-02 15:43:26.624551	1.5	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
434	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.5	Incorporation agreements preparation	إعداد عقود التأسيس والاتفاقيات	\N	not_started	2	t	2026-03-02 15:43:26.628438	1.5	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
435	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.5	Partnership model with land owner	تحديد نموذج الشراكة مع مالك الأرض	\N	not_started	3	t	2026-03-02 15:43:26.63201	1.5	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
436	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.5	Profit distribution mechanism	تحديد آلية توزيع الأرباح	\N	not_started	4	t	2026-03-02 15:43:26.635223	1.5	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
437	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.5	Parties' responsibilities & rights	تحديد مسؤوليات وحقوق الأطراف	\N	not_started	5	t	2026-03-02 15:43:26.639306	1.5	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
438	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.5	Internal governance framework	وضع إطار الحوكمة الداخلية	\N	not_started	6	t	2026-03-02 15:43:26.642953	1.5	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
439	942123b5-a03e-4091-8395-8325ea1993b9	foundation:1.5	Decision-making policy	تحديد سياسة اتخاذ القرار	\N	not_started	7	t	2026-03-02 15:43:26.645987	1.5	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
440	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.1	Complete company legal documents	استكمال مستندات الشركة القانونية	\N	not_started	0	t	2026-03-02 15:43:26.649891	2.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
441	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.1	Submit registration to regulatory body	تقديم طلب التسجيل لدى الجهة المنظمة	\N	not_started	1	t	2026-03-02 15:43:26.65327	2.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
442	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.1	Prove developer financial solvency	إثبات الملاءة المالية للمطور	\N	not_started	2	t	2026-03-02 15:43:26.657129	2.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
443	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.1	Register official contact details	تسجيل بيانات التواصل الرسمية	\N	not_started	3	t	2026-03-02 15:43:26.660733	2.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
444	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.1	Approve developer trade name	اعتماد اسم المطور التجاري	\N	not_started	4	t	2026-03-02 15:43:26.664059	2.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
445	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.1	Link developer to electronic systems	ربط المطور بالأنظمة الإلكترونية	\N	not_started	5	t	2026-03-02 15:43:26.667767	2.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
446	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.1	Update developer data as needed	تحديث بيانات المطور عند الحاجة	\N	not_started	6	t	2026-03-02 15:43:26.671331	2.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
447	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.1	Archive registration certificates & records	حفظ شهادات التسجيل والسجلات	\N	not_started	7	t	2026-03-02 15:43:26.67473	2.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
448	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.2	Prepare basic project data file	إعداد ملف بيانات المشروع الأساسية	\N	not_started	0	t	2026-03-02 15:43:26.678082	2.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
449	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.2	Define project type & components	تحديد نوع المشروع ومكوناته	\N	not_started	1	t	2026-03-02 15:43:26.681695	2.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
450	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.2	Submit electronic project registration	تقديم طلب تسجيل المشروع إلكترونياً	\N	not_started	2	t	2026-03-02 15:43:26.685088	2.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
451	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.2	Attach planning documents & permits	إرفاق المستندات التخطيطية والرخص	\N	not_started	3	t	2026-03-02 15:43:26.687891	2.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
452	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.2	Pay registration fees	دفع الرسوم المقررة للتسجيل	\N	not_started	4	t	2026-03-02 15:43:26.690719	2.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
453	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.2	Receive project reference number	استلام رقم المشروع المرجعي	\N	not_started	5	t	2026-03-02 15:43:26.695003	2.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
454	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.2	Link project to escrow account	ربط المشروع بحساب الضمان	\N	not_started	6	t	2026-03-02 15:43:26.698885	2.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
455	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.2	Update project data on amendments	تحديث بيانات المشروع عند التعديل	\N	not_started	7	t	2026-03-02 15:43:26.703455	2.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
456	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.3	Select approved trustee bank	اختيار بنك أمين حساب معتمد	\N	not_started	0	t	2026-03-02 15:43:26.706767	2.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
457	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.3	Prepare company & project documents	تجهيز مستندات الشركة والمشروع	\N	not_started	1	t	2026-03-02 15:43:26.710281	2.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
458	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.3	Sign escrow agreement with bank	توقيع اتفاقية حساب الضمان مع البنك	\N	not_started	2	t	2026-03-02 15:43:26.713772	2.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
459	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.3	Define withdrawal & deposit conditions	تحديد شروط السحب والإيداع	\N	not_started	3	t	2026-03-02 15:43:26.71732	2.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
460	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.3	Link project number to escrow account	ربط المشروع ورقمه بحساب الضمان	\N	not_started	4	t	2026-03-02 15:43:26.720758	2.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
461	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.3	Define authorized signatories	تعريف أطراف الصلاحية على الحساب	\N	not_started	5	t	2026-03-02 15:43:26.7248	2.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
462	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.3	Approve payment schedule with bank	اعتماد خطة الدفعات مع البنك	\N	not_started	6	t	2026-03-02 15:43:26.728309	2.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
463	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.3	Activate account for buyer deposits	تفعيل الحساب لاستقبال أموال المشترين	\N	not_started	7	t	2026-03-02 15:43:26.731693	2.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
464	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.4	Review applicable real estate laws	مراجعة القوانين العقارية السارية	\N	not_started	0	t	2026-03-02 15:43:26.734952	2.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
465	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.4	Align sales contracts with requirements	مواءمة عقود البيع مع المتطلبات	\N	not_started	1	t	2026-03-02 15:43:26.738663	2.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
466	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.4	Comply with advertising regulations	الالتزام بضوابط الإعلانات العقارية	\N	not_started	2	t	2026-03-02 15:43:26.742114	2.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
467	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.4	Comply with off-plan sales conditions	الالتزام بشروط البيع على الخارطة	\N	not_started	3	t	2026-03-02 15:43:26.744788	2.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
468	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.4	Prepare internal compliance policies	إعداد سياسات داخلية للامتثال	\N	not_started	4	t	2026-03-02 15:43:26.747313	2.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
469	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.4	Keep updated copies of regulations	حفظ نسخ محدثة من اللوائح	\N	not_started	5	t	2026-03-02 15:43:26.751064	2.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
470	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.4	Train team on regulatory requirements	تدريب الفريق على المتطلبات النظامية	\N	not_started	6	t	2026-03-02 15:43:26.754377	2.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
471	942123b5-a03e-4091-8395-8325ea1993b9	legal:2.4	Monitor periodic regulatory changes	مراقبة التغييرات التنظيمية الدورية	\N	not_started	7	t	2026-03-02 15:43:26.758349	2.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
472	942123b5-a03e-4091-8395-8325ea1993b9	design:3.1	Select lead architectural consultant	اختيار الاستشاري المعماري الرئيسي	\N	not_started	0	t	2026-03-02 15:43:26.761881	3.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
473	942123b5-a03e-4091-8395-8325ea1993b9	design:3.1	Appoint structural, MEP consultants	تعيين استشاريي الإنشاءات والميكانيكا والكهرباء	\N	not_started	1	t	2026-03-02 15:43:26.764672	3.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
474	942123b5-a03e-4091-8395-8325ea1993b9	design:3.1	Appoint traffic, facade & landscape consultants	تعيين استشاري المرور والواجهات والمناظر الطبيعية	\N	not_started	2	t	2026-03-02 15:43:26.767315	3.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
475	942123b5-a03e-4091-8395-8325ea1993b9	design:3.1	Appoint quantity surveyor & cost consultant	تعيين استشاري الكميات والتكلفة	\N	not_started	3	t	2026-03-02 15:43:26.770841	3.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
476	942123b5-a03e-4091-8395-8325ea1993b9	design:3.1	Define scope of work per consultant	تحديد نطاق عمل كل استشاري	\N	not_started	4	t	2026-03-02 15:43:26.774248	3.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
477	942123b5-a03e-4091-8395-8325ea1993b9	design:3.1	Sign technical consultancy contracts	توقيع عقود الاستشارات الفنية	\N	not_started	5	t	2026-03-02 15:43:26.777373	3.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
478	942123b5-a03e-4091-8395-8325ea1993b9	design:3.1	Define inter-consultant coordination mechanism	تحديد آلية التنسيق بين الاستشاريين	\N	not_started	6	t	2026-03-02 15:43:26.780683	3.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
479	942123b5-a03e-4091-8395-8325ea1993b9	design:3.1	Set design schedule	وضع جدول زمني للتصميمات	\N	not_started	7	t	2026-03-02 15:43:26.7833	3.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
480	942123b5-a03e-4091-8395-8325ea1993b9	design:3.2	Prepare concept design & massing	إعداد التصور المبدئي والكتل	\N	not_started	0	t	2026-03-02 15:43:26.786461	3.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
481	942123b5-a03e-4091-8395-8325ea1993b9	design:3.2	Prepare preliminary architectural plans	إعداد المخطط المعماري المبدئي	\N	not_started	1	t	2026-03-02 15:43:26.78967	3.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
482	942123b5-a03e-4091-8395-8325ea1993b9	design:3.2	Develop detailed design drawings	تطوير التصميم إلى مخطط تفصيلي	\N	not_started	2	t	2026-03-02 15:43:26.792833	3.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
483	942123b5-a03e-4091-8395-8325ea1993b9	design:3.2	Coordinate architectural, structural & MEP	التنسيق بين المعماري والإنشائي والميكانيكي	\N	not_started	3	t	2026-03-02 15:43:26.796228	3.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
484	942123b5-a03e-4091-8395-8325ea1993b9	design:3.2	Code & requirements review during design	مراجعة الكود والاشتراطات خلال التصميم	\N	not_started	4	t	2026-03-02 15:43:26.800749	3.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
485	942123b5-a03e-4091-8395-8325ea1993b9	design:3.2	Prepare authority submission drawings	إعداد المخططات الصادرة للجهات	\N	not_started	5	t	2026-03-02 15:43:26.804169	3.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
486	942123b5-a03e-4091-8395-8325ea1993b9	design:3.2	Prepare tender drawings	إعداد المخططات الصادرة للمناقصة	\N	not_started	6	t	2026-03-02 15:43:26.807274	3.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
487	942123b5-a03e-4091-8395-8325ea1993b9	design:3.2	Update designs per authority comments	تحديث التصاميم بناءً على ملاحظات الجهات	\N	not_started	7	t	2026-03-02 15:43:26.810607	3.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
488	942123b5-a03e-4091-8395-8325ea1993b9	design:3.3	Obtain land plan & affection plan	استخراج مخطط الأرض والـ Affection Plan	\N	not_started	0	t	2026-03-02 15:43:26.813886	3.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
489	942123b5-a03e-4091-8395-8325ea1993b9	design:3.3	Submit plans to municipality	تقديم المخططات للبلدية أو الجهة المختصة	\N	not_started	1	t	2026-03-02 15:43:26.817218	3.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
490	942123b5-a03e-4091-8395-8325ea1993b9	design:3.3	Obtain electricity & water NOC	الحصول على عدم ممانعة الكهرباء والمياه	\N	not_started	2	t	2026-03-02 15:43:26.820562	3.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
491	942123b5-a03e-4091-8395-8325ea1993b9	design:3.3	Obtain roads & access NOC	الحصول على عدم ممانعة الطرق والمداخل	\N	not_started	3	t	2026-03-02 15:43:26.823847	3.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
492	942123b5-a03e-4091-8395-8325ea1993b9	design:3.3	Obtain civil defense NOC	الحصول على عدم ممانعة الدفاع المدني	\N	not_started	4	t	2026-03-02 15:43:26.827086	3.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
493	942123b5-a03e-4091-8395-8325ea1993b9	design:3.3	Obtain telecom & other utilities NOC	الحصول على عدم ممانعة الاتصالات والبنى الأخرى	\N	not_started	5	t	2026-03-02 15:43:26.830536	3.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
494	942123b5-a03e-4091-8395-8325ea1993b9	design:3.3	Complete comments until final approval	استكمال الملاحظات حتى الموافقة النهائية	\N	not_started	6	t	2026-03-02 15:43:26.833693	3.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
495	942123b5-a03e-4091-8395-8325ea1993b9	design:3.3	Document all approvals in project file	توثيق جميع الموافقات في ملف المشروع	\N	not_started	7	t	2026-03-02 15:43:26.836696	3.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
496	942123b5-a03e-4091-8395-8325ea1993b9	design:3.4	Submit building permit with approved plans	تقديم طلب رخصة البناء بالمخططات المعتمدة	\N	not_started	0	t	2026-03-02 15:43:26.839774	3.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
497	942123b5-a03e-4091-8395-8325ea1993b9	design:3.4	Pay building permit fees	سداد رسوم رخصة البناء	\N	not_started	1	t	2026-03-02 15:43:26.842823	3.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
498	942123b5-a03e-4091-8395-8325ea1993b9	design:3.4	Complete technical & legal requirements	استكمال المتطلبات الفنية والقانونية	\N	not_started	2	t	2026-03-02 15:43:26.846038	3.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
499	942123b5-a03e-4091-8395-8325ea1993b9	design:3.4	Receive final building permit	استلام رخصة البناء النهائية	\N	not_started	3	t	2026-03-02 15:43:26.848808	3.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
500	942123b5-a03e-4091-8395-8325ea1993b9	design:3.4	Obtain site preparation permits	استخراج تصاريح تجهيز الموقع	\N	not_started	4	t	2026-03-02 15:43:26.852054	3.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
501	942123b5-a03e-4091-8395-8325ea1993b9	design:3.4	Obtain signage & hoarding permits	استخراج تصاريح اللوحات والحواجز المؤقتة	\N	not_started	5	t	2026-03-02 15:43:26.85568	3.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
502	942123b5-a03e-4091-8395-8325ea1993b9	design:3.4	Share permit data with consultant & contractor	مشاركة بيانات الرخصة مع الاستشاري والمقاول	\N	not_started	6	t	2026-03-02 15:43:26.858899	3.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
503	942123b5-a03e-4091-8395-8325ea1993b9	design:3.4	Archive permit documents in project records	حفظ وثائق الرخصة ضمن سجلات المشروع	\N	not_started	7	t	2026-03-02 15:43:26.861969	3.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
504	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.1	Prepare project financing file	إعداد ملف تمويلي للمشروع	\N	not_started	0	t	2026-03-02 15:43:26.865227	4.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
505	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.1	Negotiate financing terms with banks	التفاوض مع البنوك على شروط التمويل	\N	not_started	1	t	2026-03-02 15:43:26.868016	4.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
506	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.1	Agree on financing amounts & drawdown schedule	الاتفاق على مبالغ التمويل وجدول السحب	\N	not_started	2	t	2026-03-02 15:43:26.871059	4.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
507	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.1	Pledge assets or provide guarantees	رهن الأصول أو تقديم الضمانات المطلوبة	\N	not_started	3	t	2026-03-02 15:43:26.874566	4.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
508	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.1	Sign final financing agreements	توقيع اتفاقيات التمويل النهائية	\N	not_started	4	t	2026-03-02 15:43:26.877988	4.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
509	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.1	Link drawdown schedules to work progress	ربط جداول السحب بتقدم الأعمال	\N	not_started	5	t	2026-03-02 15:43:26.881255	4.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
510	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.1	Link financing to escrow account	ربط التمويل بحساب الضمان	\N	not_started	6	t	2026-03-02 15:43:26.88505	4.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
511	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.1	Monitor compliance with financier covenants	متابعة شروط الالتزام مع الممولين	\N	not_started	7	t	2026-03-02 15:43:26.888114	4.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
512	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.2	Develop project visual identity	تطوير الهوية البصرية للمشروع	\N	not_started	0	t	2026-03-02 15:43:26.891462	4.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
513	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.2	Prepare brochures & printed materials	إعداد البروشورات والمواد المطبوعة	\N	not_started	1	t	2026-03-02 15:43:26.895033	4.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
514	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.2	Prepare 3D renders & visual presentations	إعداد التصوير ثلاثي الأبعاد والعروض المرئية	\N	not_started	2	t	2026-03-02 15:43:26.898512	4.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
515	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.2	Build project website	تجهيز الموقع الإلكتروني للمشروع	\N	not_started	3	t	2026-03-02 15:43:26.902272	4.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
516	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.2	Prepare unit & floor plans for sales	إعداد مخططات الشقق والأدوار للبيع	\N	not_started	4	t	2026-03-02 15:43:26.906674	4.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
517	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.2	Prepare price lists & payment plans	إعداد جداول الأسعار وخطط السداد	\N	not_started	5	t	2026-03-02 15:43:26.910488	4.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
518	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.2	Prepare sales office display materials	إعداد مواد العرض لمكاتب البيع	\N	not_started	6	t	2026-03-02 15:43:26.913315	4.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
519	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.2	Prepare social media content	تجهيز محتوى منصات التواصل الاجتماعي	\N	not_started	7	t	2026-03-02 15:43:26.916597	4.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
520	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.3	Submit advertising permit applications	تقديم طلبات تصاريح الإعلانات للجهة المختصة	\N	not_started	0	t	2026-03-02 15:43:26.920911	4.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
521	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.3	Enter project & escrow data in permit	إدخال بيانات المشروع وحساب الضمان في التصريح	\N	not_started	1	t	2026-03-02 15:43:26.923899	4.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
522	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.3	Obtain QR codes or required codes	الحصول على رموز الاستجابة أو الأكواد المطلوبة	\N	not_started	2	t	2026-03-02 15:43:26.927098	4.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
523	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.3	Include permit data in all advertisements	إدراج بيانات التصريح في جميع الإعلانات	\N	not_started	3	t	2026-03-02 15:43:26.930494	4.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
524	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.3	Comply with approved advertising terms	الالتزام بنصوص وشروط الإعلانات المعتمدة	\N	not_started	4	t	2026-03-02 15:43:26.933884	4.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
525	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.3	Monitor marketing materials for compliance	مراقبة المواد التسويقية للامتثال	\N	not_started	5	t	2026-03-02 15:43:26.937386	4.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
526	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.3	Renew advertising permits as needed	تجديد تصاريح الإعلانات عند الحاجة	\N	not_started	6	t	2026-03-02 15:43:26.940579	4.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
527	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.3	Archive all advertising permits	حفظ نسخ من جميع التصاريح الإعلانية	\N	not_started	7	t	2026-03-02 15:43:26.943566	4.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
528	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.4	Prepare booking forms & purchase applications	إعداد نماذج الحجز وطلبات الشراء	\N	not_started	0	t	2026-03-02 15:43:26.946863	4.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
529	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.4	Prepare sale & purchase agreement draft	إعداد مسودة عقد البيع والشراء	\N	not_started	1	t	2026-03-02 15:43:26.950945	4.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
530	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.4	Contract licensed real estate brokers	التعاقد مع الوسطاء العقاريين المرخصين	\N	not_started	2	t	2026-03-02 15:43:26.954816	4.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
531	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.4	Receive & document reservations	استقبال الحجوزات وتوثيقها	\N	not_started	3	t	2026-03-02 15:43:26.957502	4.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
532	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.4	Sign sales contracts with buyers	توقيع عقود البيع مع المشترين	\N	not_started	4	t	2026-03-02 15:43:26.961304	4.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
533	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.4	Collect payments in escrow account only	تحصيل الدفعات في حساب الضمان فقط	\N	not_started	5	t	2026-03-02 15:43:26.965302	4.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
534	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.4	Register sales in real estate system	تسجيل عمليات البيع في النظام العقاري	\N	not_started	6	t	2026-03-02 15:43:26.968801	4.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
535	942123b5-a03e-4091-8395-8325ea1993b9	financing:4.4	Monitor buyer payment schedule compliance	متابعة التزام المشترين بجداول السداد	\N	not_started	7	t	2026-03-02 15:43:26.972048	4.4	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
536	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.1	Prepare main contractor tender documents	إعداد وثائق المناقصة للمقاول الرئيسي	\N	not_started	0	t	2026-03-02 15:43:26.975255	5.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
537	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.1	Prepare qualified contractors shortlist	إعداد قائمة المقاولين المؤهلين	\N	not_started	1	t	2026-03-02 15:43:26.978516	5.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
538	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.1	Send invitations & receive bids	إرسال الدعوات واستلام العطاءات	\N	not_started	2	t	2026-03-02 15:43:26.98181	5.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
539	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.1	Organize site visits for contractors	تنظيم زيارات الموقع للمقاولين	\N	not_started	3	t	2026-03-02 15:43:26.98495	5.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
540	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.1	Respond to contractor queries	الرد على استفسارات المقاولين	\N	not_started	4	t	2026-03-02 15:43:26.98837	5.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
541	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.1	Technical & financial bid comparison	مقارنة العطاءات فنياً ومالياً	\N	not_started	5	t	2026-03-02 15:43:26.991785	5.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
542	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.1	Select preferred contractor	اختيار المقاول المفضل	\N	not_started	6	t	2026-03-02 15:43:26.994976	5.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
543	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.1	Submit award recommendation	رفع التوصية لاعتماد الترسية	\N	not_started	7	t	2026-03-02 15:43:26.997578	5.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
544	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.2	Negotiate final price & payment terms	التفاوض على السعر النهائي وشروط الدفع	\N	not_started	0	t	2026-03-02 15:43:27.000602	5.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
545	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.2	Agree on contract program schedule	الاتفاق على البرنامج الزمني للعقد	\N	not_started	1	t	2026-03-02 15:43:27.003721	5.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
546	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.2	Agree on quality & defects liability terms	الاتفاق على شروط الجودة وضمان العيوب	\N	not_started	2	t	2026-03-02 15:43:27.006647	5.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
547	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.2	Sign building contract with main contractor	توقيع عقد البناء مع المقاول الرئيسي	\N	not_started	3	t	2026-03-02 15:43:27.010228	5.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
548	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.2	Notify consultants of contract	إشعار الاستشاريين بالتعاقد	\N	not_started	4	t	2026-03-02 15:43:27.013382	5.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
549	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.2	Send contract copy to financiers	إرسال نسخة العقد للجهات الممولة	\N	not_started	5	t	2026-03-02 15:43:27.016622	5.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
550	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.2	Update project plan based on contract	تحديث خطة المشروع بناءً على العقد	\N	not_started	6	t	2026-03-02 15:43:27.019891	5.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
551	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.2	Issue commencement orders to contractor	إصدار أوامر المباشرة للمقاول	\N	not_started	7	t	2026-03-02 15:43:27.023125	5.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
552	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.3	Contractor site mobilization	تجهيز الموقع من قبل المقاول	\N	not_started	0	t	2026-03-02 15:43:27.027106	5.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
553	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.3	Hold periodic progress meetings	عقد اجتماعات تقدم الأعمال الدورية	\N	not_started	1	t	2026-03-02 15:43:27.029813	5.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
554	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.3	Review updated programs	مراجعة البرامج الزمنية المحدثة	\N	not_started	2	t	2026-03-02 15:43:27.033246	5.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
555	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.3	Approve materials & key suppliers	اعتماد المواد والموردين الرئيسيين	\N	not_started	3	t	2026-03-02 15:43:27.035894	5.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
556	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.3	Review & approve shop drawings	مراجعة واعتماد مخططات الورشة	\N	not_started	4	t	2026-03-02 15:43:27.038936	5.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
557	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.3	Manage variation orders & claims	إدارة أوامر التغيير والمطالبات	\N	not_started	5	t	2026-03-02 15:43:27.041959	5.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
558	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.3	Monitor contractor safety compliance	متابعة التزام المقاول بالسلامة	\N	not_started	6	t	2026-03-02 15:43:27.045086	5.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
559	942123b5-a03e-4091-8395-8325ea1993b9	execution:5.3	Document progress with photos & reports	توثيق تقدم الأعمال بالصور والتقارير	\N	not_started	7	t	2026-03-02 15:43:27.04816	5.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
560	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.1	Complete final finishing works	استكمال أعمال التشطيبات النهائية	\N	not_started	0	t	2026-03-02 15:43:27.051891	6.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
561	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.1	Perform electrical & mechanical system tests	تنفيذ اختبارات أنظمة الكهرباء والميكانيك	\N	not_started	1	t	2026-03-02 15:43:27.055681	6.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
562	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.1	Perform fire & safety system tests	تنفيذ اختبارات أنظمة الحريق والسلامة	\N	not_started	2	t	2026-03-02 15:43:27.059553	6.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
563	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.1	Address test result findings	معالجة الملاحظات الناتجة عن الاختبارات	\N	not_started	3	t	2026-03-02 15:43:27.063155	6.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
564	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.1	Prepare common areas & facilities	تجهيز المواقع المشتركة والمرافق	\N	not_started	4	t	2026-03-02 15:43:27.067387	6.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
565	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.1	Internal cleaning & unit preparation	تنظيف وتسليم الوحدات داخلياً	\N	not_started	5	t	2026-03-02 15:43:27.071302	6.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
566	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.1	Prepare building system files	تجهيز ملفات أنظمة المبنى	\N	not_started	6	t	2026-03-02 15:43:27.075249	6.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
567	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.1	Prepare final internal snagging list	إعداد قائمة الملاحظات الداخلية النهائية	\N	not_started	7	t	2026-03-02 15:43:27.079151	6.1	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
568	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.2	Coordinate official authority site visits	تنسيق زيارات الجهات الرسمية للموقع	\N	not_started	0	t	2026-03-02 15:43:27.083572	6.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
569	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.2	Complete municipality & authority comments	استكمال ملاحظات البلدية والجهات الأخرى	\N	not_started	1	t	2026-03-02 15:43:27.087263	6.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
570	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.2	Submit building completion certificate request	تقديم طلب شهادة إنجاز المبنى	\N	not_started	2	t	2026-03-02 15:43:27.090761	6.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
571	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.2	Receive final completion certificate	استلام شهادة الإنجاز النهائية	\N	not_started	3	t	2026-03-02 15:43:27.094136	6.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
572	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.2	Share certificate with relevant parties	مشاركة الشهادة مع الجهات المعنية	\N	not_started	4	t	2026-03-02 15:43:27.098422	6.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
573	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.2	Update project data in records	تحديث بيانات المشروع في السجلات	\N	not_started	5	t	2026-03-02 15:43:27.101903	6.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
574	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.2	Notify financiers & buyers of completion	إشعار الممولين والمشترين بإنجاز المشروع	\N	not_started	6	t	2026-03-02 15:43:27.105168	6.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
575	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.2	Archive all completion documents	أرشفة جميع وثائق الإنهاء	\N	not_started	7	t	2026-03-02 15:43:27.108288	6.2	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
576	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.3	Invite buyers for inspection & handover	دعوة المشترين لزيارات الفحص والاستلام	\N	not_started	0	t	2026-03-02 15:43:27.111765	6.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
577	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.3	Document snags per unit individually	توثيق الملاحظات لكل وحدة على حدة	\N	not_started	1	t	2026-03-02 15:43:27.114735	6.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
578	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.3	Address snags before final handover	معالجة الملاحظات قبل التسليم النهائي	\N	not_started	2	t	2026-03-02 15:43:27.118856	6.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
579	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.3	Sign unit handover certificates with owners	توقيع محاضر استلام الوحدات مع الملاك	\N	not_started	3	t	2026-03-02 15:43:27.121944	6.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
580	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.3	Activate contract warranty periods	تفعيل فترات الضمان المحددة في العقود	\N	not_started	4	t	2026-03-02 15:43:27.125242	6.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
581	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.3	Receive & address warranty defect reports	استقبال ومعالجة بلاغات العيوب خلال الضمان	\N	not_started	5	t	2026-03-02 15:43:27.128871	6.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
582	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.3	Hand over unit files & keys to owners	تسليم ملفات الوحدات والمفاتيح للملاك	\N	not_started	6	t	2026-03-02 15:43:27.131633	6.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
583	942123b5-a03e-4091-8395-8325ea1993b9	handover:6.3	Transfer project to facility management or HOA	نقل بيانات المشروع إلى إدارة المرافق أو جمعية الملاك	\N	not_started	7	t	2026-03-02 15:43:27.134731	6.3	\N	\N	\N	\N	f	0.00	0.00	\N	\N	\N	\N
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions (id, wallet_id, project_id, amount, description, type, created_at) FROM stdin;
ec991fa6-3fc5-4063-977f-4484315b5801	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	18000000.00	ضخ رأس مال — شراء الأرض	deposit	2025-02-15 00:00:00
541af9af-d842-4a46-a4eb-8de3acac8082	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	7900000.00	ضخ رأس مال — إيداع RERA 20%	deposit	2025-02-20 00:00:00
ce89e802-28f4-45af-9e0e-626034cb081e	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	2100000.00	ضخ رأس مال — احتياطي تشغيلي	deposit	2025-02-25 00:00:00
d6ad39fd-bc11-45a7-82ff-e5bf4d41a72f	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	-18000000.00	سداد قيمة الأرض	withdrawal	2025-03-01 00:00:00
6fc0046f-5c42-4188-8e19-d790aedc540e	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	-720000.00	رسم تسجيل الأرض 4%	withdrawal	2025-03-02 00:00:00
41edd7a8-f8b7-4a09-bb6a-bfd8c966479b	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	-473136.00	رسوم التصميم (60% دفعة أولى)	withdrawal	2025-03-10 00:00:00
a92c59f4-5937-47da-bd29-d9d42bf42d9b	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	-172497.00	رسوم الإشراف (25% دفعة أولى)	withdrawal	2025-03-10 00:00:00
fa3681b5-a016-420a-8344-87d8b499501b	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	-25000.00	تقرير فحص التربة	withdrawal	2025-01-15 00:00:00
7efcd6e5-91eb-4431-ab0d-2a39ed1f1bab	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	-8000.00	أعمال المساحة الطبوغرافية	withdrawal	2025-01-20 00:00:00
9803895b-2e3e-4b0b-a1b9-247bc540229c	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	-12000.00	رسوم المساح	withdrawal	2025-01-25 00:00:00
6d70b04d-ff9b-42cf-a996-64068b855d38	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	-500000.00	رسوم الجهات الحكومية	withdrawal	2025-03-15 00:00:00
df7091d1-b02b-4306-b3ae-a8de1786a87a	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	-150000.00	رسوم تسجيل المشروع RERA	withdrawal	2025-02-28 00:00:00
2d67d853-2714-40a2-8943-041852462178	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	-39100.00	رسوم تسجيل الوحدات RERA	withdrawal	2025-03-05 00:00:00
127b5cd2-1aef-4ddb-9220-a00c1e051604	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	-18000.00	تقارير تدقيق RERA	withdrawal	2025-04-01 00:00:00
0ed370ac-c892-4f1b-bb70-4d9f7bcfc878	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	-200000.00	تسويق وإعلان — مرحلة الإطلاق	withdrawal	2025-04-15 00:00:00
de391869-d4c1-4a34-9a81-9e1b515c0472	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	-140000.00	رسوم حساب الإسكرو	withdrawal	2025-02-25 00:00:00
5e2a2a96-0d15-4563-aa1d-4259187f3501	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	-20000.00	رسوم بنكية	withdrawal	2025-03-01 00:00:00
11cb3333-e5f6-4c64-92c0-c91ff7c402c6	wb-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	1518750.00	حجوزات 5 وحدات — دفعة 15%	deposit	2025-04-20 00:00:00
4e616119-8604-4e35-a6dd-2a18c4d534e1	wb-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	1518750.00	حجوزات 5 وحدات — دفعة 15%	deposit	2025-05-15 00:00:00
1f771399-ea81-4696-a5e0-0fb55cf8b0cf	wb-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	607500.00	أقساط بناء — 3 وحدات مبكرة (10%)	deposit	2025-06-01 00:00:00
151a2a09-bf91-4101-b6c5-f52fc04a5045	wb-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	-1710000.00	IPC #1 — تعبئة موقع وأعمال حفر	withdrawal	2025-04-15 00:00:00
bd38653f-702e-48d4-8615-81b70029f653	wb-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	-1392500.00	IPC #2 — أعمال خرسانة الأساسات	withdrawal	2025-05-20 00:00:00
f776b3be-3c41-4473-bff4-6939e39e5e7e	wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	3000000.00	ضخ رأس مال — دفعة ثانية للمستثمرين	deposit	2025-05-01 00:00:00
\.


--
-- Data for Name: variation_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.variation_orders (id, project_id, contract_id, vo_number, vo_type, title, title_ar, description, estimated_cost, approved_cost, status, impact_on_tcc, impact_on_schedule_days, cumulative_vo_percent, approved_by, approved_at, created_at) FROM stdin;
13	905c5323-dcbd-4eeb-b944-acd6d4f6a037	16	VO-001	VO_B_AUTHORITY	Additional Piling – Soil Condition	أعمال خوازيق إضافية — ظروف التربة	تقرير التربة أظهر حاجة لخوازيق إضافية في الجانب الشرقي	180000	165000	APPROVED	165000	5	0.418	لجنة التغييرات	2025-06-05 00:00:00	2026-03-01 23:21:36.104308
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallets (id, project_id, type, label, balance) FROM stdin;
wa-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Wallet_A	Investor Equity – Vertix	1189294.00
wb-vertix-001	905c5323-dcbd-4eeb-b944-acd6d4f6a037	Wallet_B	Escrow Account – Vertix	8428096.00
\.


--
-- Data for Name: wbs_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wbs_items (id, project_id, level, code, title, description, parent_id, sort_order, owner, start_date, end_date, status, created_at) FROM stdin;
\.


--
-- Name: agent_outputs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.agent_outputs_id_seq', 2, true);


--
-- Name: agent_runs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.agent_runs_id_seq', 4, true);


--
-- Name: agent_tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.agent_tasks_id_seq', 1, false);


--
-- Name: ai_advisory_scores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ai_advisory_scores_id_seq', 36, true);


--
-- Name: alerts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.alerts_id_seq', 1, false);


--
-- Name: approval_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.approval_requests_id_seq', 1, false);


--
-- Name: audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.audit_log_id_seq', 1, false);


--
-- Name: board_decision_view_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.board_decision_view_id_seq', 1, false);


--
-- Name: board_portfolio_cache_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.board_portfolio_cache_id_seq', 1, true);


--
-- Name: board_project_cache_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.board_project_cache_id_seq', 6, true);


--
-- Name: capital_balances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.capital_balances_id_seq', 10, true);


--
-- Name: capital_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.capital_events_id_seq', 116, true);


--
-- Name: chat_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_history_id_seq', 104, true);


--
-- Name: command_center_inquiries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.command_center_inquiries_id_seq', 1, false);


--
-- Name: committee_decisions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.committee_decisions_id_seq', 4, true);


--
-- Name: competitor_projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.competitor_projects_id_seq', 1, false);


--
-- Name: conflict_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.conflict_records_id_seq', 1, false);


--
-- Name: consultant_financials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.consultant_financials_id_seq', 47, true);


--
-- Name: consultants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.consultants_id_seq', 16, true);


--
-- Name: contracts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contracts_id_seq', 19, true);


--
-- Name: conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.conversations_id_seq', 1, false);


--
-- Name: draft_decisions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.draft_decisions_id_seq', 1, false);


--
-- Name: evaluator_scores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.evaluator_scores_id_seq', 108, true);


--
-- Name: extraction_fields_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.extraction_fields_id_seq', 16, true);


--
-- Name: extraction_runs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.extraction_runs_id_seq', 2, true);


--
-- Name: feasibility_studies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.feasibility_studies_id_seq', 30, true);


--
-- Name: governance_gates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.governance_gates_id_seq', 36, true);


--
-- Name: ipcs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ipcs_id_seq', 25, true);


--
-- Name: knowledge_base_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.knowledge_base_id_seq', 8, true);


--
-- Name: layla_conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.layla_conversations_id_seq', 2, true);


--
-- Name: leadership_directives_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.leadership_directives_id_seq', 1, false);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.messages_id_seq', 1, false);


--
-- Name: payment_plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payment_plans_id_seq', 9, true);


--
-- Name: portfolio_metrics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.portfolio_metrics_id_seq', 274, true);


--
-- Name: project_assumptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.project_assumptions_id_seq', 1, false);


--
-- Name: project_budget_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.project_budget_items_id_seq', 92, true);


--
-- Name: project_cash_flows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.project_cash_flows_id_seq', 1, false);


--
-- Name: project_consultants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.project_consultants_id_seq', 55, true);


--
-- Name: project_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.project_documents_id_seq', 2, true);


--
-- Name: project_financials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.project_financials_id_seq', 3, true);


--
-- Name: project_scenarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.project_scenarios_id_seq', 5, true);


--
-- Name: project_state_transitions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.project_state_transitions_id_seq', 52, true);


--
-- Name: proposal_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.proposal_items_id_seq', 1, false);


--
-- Name: recommendations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.recommendations_id_seq', 1, false);


--
-- Name: reconciliation_ledger_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reconciliation_ledger_id_seq', 1, false);


--
-- Name: reconciliation_proposals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reconciliation_proposals_id_seq', 1, false);


--
-- Name: regulatory_dependencies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.regulatory_dependencies_id_seq', 1, false);


--
-- Name: regulatory_nodes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.regulatory_nodes_id_seq', 72, true);


--
-- Name: report_versions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.report_versions_id_seq', 1, false);


--
-- Name: risk_scores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.risk_scores_id_seq', 24, true);


--
-- Name: sales_units_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sales_units_id_seq', 336, true);


--
-- Name: source_registry_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.source_registry_id_seq', 24, true);


--
-- Name: stage_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stage_items_id_seq', 583, true);


--
-- Name: variation_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.variation_orders_id_seq', 13, true);


--
-- Name: wbs_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wbs_items_id_seq', 1, false);


--
-- Name: agent_outputs agent_outputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_outputs
    ADD CONSTRAINT agent_outputs_pkey PRIMARY KEY (id);


--
-- Name: agent_runs agent_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_runs
    ADD CONSTRAINT agent_runs_pkey PRIMARY KEY (id);


--
-- Name: agent_tasks agent_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tasks
    ADD CONSTRAINT agent_tasks_pkey PRIMARY KEY (id);


--
-- Name: ai_advisory_scores ai_advisory_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_advisory_scores
    ADD CONSTRAINT ai_advisory_scores_pkey PRIMARY KEY (id);


--
-- Name: ai_agents ai_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agents
    ADD CONSTRAINT ai_agents_pkey PRIMARY KEY (id);


--
-- Name: ai_market_data ai_market_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_market_data
    ADD CONSTRAINT ai_market_data_pkey PRIMARY KEY (id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: approval_requests approval_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: board_decision_view board_decision_view_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_decision_view
    ADD CONSTRAINT board_decision_view_pkey PRIMARY KEY (id);


--
-- Name: board_portfolio_cache board_portfolio_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_portfolio_cache
    ADD CONSTRAINT board_portfolio_cache_pkey PRIMARY KEY (id);


--
-- Name: board_project_cache board_project_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_project_cache
    ADD CONSTRAINT board_project_cache_pkey PRIMARY KEY (id);


--
-- Name: capital_balances capital_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_balances
    ADD CONSTRAINT capital_balances_pkey PRIMARY KEY (id);


--
-- Name: capital_events capital_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_events
    ADD CONSTRAINT capital_events_pkey PRIMARY KEY (id);


--
-- Name: chat_history chat_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_history
    ADD CONSTRAINT chat_history_pkey PRIMARY KEY (id);


--
-- Name: command_center_inquiries command_center_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.command_center_inquiries
    ADD CONSTRAINT command_center_inquiries_pkey PRIMARY KEY (id);


--
-- Name: committee_decisions committee_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.committee_decisions
    ADD CONSTRAINT committee_decisions_pkey PRIMARY KEY (id);


--
-- Name: competitor_projects competitor_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_projects
    ADD CONSTRAINT competitor_projects_pkey PRIMARY KEY (id);


--
-- Name: conflict_records conflict_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conflict_records
    ADD CONSTRAINT conflict_records_pkey PRIMARY KEY (id);


--
-- Name: construction_milestones construction_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_milestones
    ADD CONSTRAINT construction_milestones_pkey PRIMARY KEY (id);


--
-- Name: consultant_financials consultant_financials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultant_financials
    ADD CONSTRAINT consultant_financials_pkey PRIMARY KEY (id);


--
-- Name: consultants consultants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultants
    ADD CONSTRAINT consultants_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: draft_decisions draft_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_decisions
    ADD CONSTRAINT draft_decisions_pkey PRIMARY KEY (id);


--
-- Name: evaluator_scores evaluator_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluator_scores
    ADD CONSTRAINT evaluator_scores_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: extraction_fields extraction_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction_fields
    ADD CONSTRAINT extraction_fields_pkey PRIMARY KEY (id);


--
-- Name: extraction_runs extraction_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction_runs
    ADD CONSTRAINT extraction_runs_pkey PRIMARY KEY (id);


--
-- Name: feasibility_studies feasibility_studies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feasibility_studies
    ADD CONSTRAINT feasibility_studies_pkey PRIMARY KEY (id);


--
-- Name: governance_gates governance_gates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_gates
    ADD CONSTRAINT governance_gates_pkey PRIMARY KEY (id);


--
-- Name: ipcs ipcs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipcs
    ADD CONSTRAINT ipcs_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base knowledge_base_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_pkey PRIMARY KEY (id);


--
-- Name: layla_conversations layla_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layla_conversations
    ADD CONSTRAINT layla_conversations_pkey PRIMARY KEY (id);


--
-- Name: leadership_directives leadership_directives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leadership_directives
    ADD CONSTRAINT leadership_directives_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: payment_plans payment_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_pkey PRIMARY KEY (id);


--
-- Name: portfolio_metrics portfolio_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_metrics
    ADD CONSTRAINT portfolio_metrics_pkey PRIMARY KEY (id);


--
-- Name: project_assumptions project_assumptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assumptions
    ADD CONSTRAINT project_assumptions_pkey PRIMARY KEY (id);


--
-- Name: project_budget_items project_budget_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_budget_items
    ADD CONSTRAINT project_budget_items_pkey PRIMARY KEY (id);


--
-- Name: project_cash_flows project_cash_flows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_cash_flows
    ADD CONSTRAINT project_cash_flows_pkey PRIMARY KEY (id);


--
-- Name: project_consultants project_consultants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_consultants
    ADD CONSTRAINT project_consultants_pkey PRIMARY KEY (id);


--
-- Name: project_documents project_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT project_documents_pkey PRIMARY KEY (id);


--
-- Name: project_financials project_financials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_financials
    ADD CONSTRAINT project_financials_pkey PRIMARY KEY (id);


--
-- Name: project_scenarios project_scenarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_scenarios
    ADD CONSTRAINT project_scenarios_pkey PRIMARY KEY (id);


--
-- Name: project_state_transitions project_state_transitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_state_transitions
    ADD CONSTRAINT project_state_transitions_pkey PRIMARY KEY (id);


--
-- Name: project_tasks project_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: proposal_items proposal_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_items
    ADD CONSTRAINT proposal_items_pkey PRIMARY KEY (id);


--
-- Name: recommendations recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT recommendations_pkey PRIMARY KEY (id);


--
-- Name: reconciliation_ledger reconciliation_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_ledger
    ADD CONSTRAINT reconciliation_ledger_pkey PRIMARY KEY (id);


--
-- Name: reconciliation_proposals reconciliation_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_proposals
    ADD CONSTRAINT reconciliation_proposals_pkey PRIMARY KEY (id);


--
-- Name: regulatory_dependencies regulatory_dependencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_dependencies
    ADD CONSTRAINT regulatory_dependencies_pkey PRIMARY KEY (id);


--
-- Name: regulatory_nodes regulatory_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_nodes
    ADD CONSTRAINT regulatory_nodes_pkey PRIMARY KEY (id);


--
-- Name: report_versions report_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_versions
    ADD CONSTRAINT report_versions_pkey PRIMARY KEY (id);


--
-- Name: risk_scores risk_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_scores
    ADD CONSTRAINT risk_scores_pkey PRIMARY KEY (id);


--
-- Name: sales_units sales_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_units
    ADD CONSTRAINT sales_units_pkey PRIMARY KEY (id);


--
-- Name: source_registry source_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_registry
    ADD CONSTRAINT source_registry_pkey PRIMARY KEY (id);


--
-- Name: stage_items stage_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stage_items
    ADD CONSTRAINT stage_items_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: variation_orders variation_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variation_orders
    ADD CONSTRAINT variation_orders_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: wbs_items wbs_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_items
    ADD CONSTRAINT wbs_items_pkey PRIMARY KEY (id);


--
-- Name: agent_outputs agent_outputs_agent_id_ai_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_outputs
    ADD CONSTRAINT agent_outputs_agent_id_ai_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id);


--
-- Name: agent_outputs agent_outputs_run_id_agent_runs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_outputs
    ADD CONSTRAINT agent_outputs_run_id_agent_runs_id_fk FOREIGN KEY (run_id) REFERENCES public.agent_runs(id);


--
-- Name: agent_runs agent_runs_agent_id_ai_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_runs
    ADD CONSTRAINT agent_runs_agent_id_ai_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id);


--
-- Name: agent_runs agent_runs_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_runs
    ADD CONSTRAINT agent_runs_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: agent_tasks agent_tasks_from_agent_id_ai_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tasks
    ADD CONSTRAINT agent_tasks_from_agent_id_ai_agents_id_fk FOREIGN KEY (from_agent_id) REFERENCES public.ai_agents(id);


--
-- Name: agent_tasks agent_tasks_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tasks
    ADD CONSTRAINT agent_tasks_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: agent_tasks agent_tasks_to_agent_id_ai_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tasks
    ADD CONSTRAINT agent_tasks_to_agent_id_ai_agents_id_fk FOREIGN KEY (to_agent_id) REFERENCES public.ai_agents(id);


--
-- Name: ai_advisory_scores ai_advisory_scores_consultant_id_consultants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_advisory_scores
    ADD CONSTRAINT ai_advisory_scores_consultant_id_consultants_id_fk FOREIGN KEY (consultant_id) REFERENCES public.consultants(id) ON DELETE CASCADE;


--
-- Name: ai_advisory_scores ai_advisory_scores_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_advisory_scores
    ADD CONSTRAINT ai_advisory_scores_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: ai_market_data ai_market_data_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_market_data
    ADD CONSTRAINT ai_market_data_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: alerts alerts_agent_id_ai_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_agent_id_ai_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id);


--
-- Name: alerts alerts_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: alerts alerts_run_id_agent_runs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_run_id_agent_runs_id_fk FOREIGN KEY (run_id) REFERENCES public.agent_runs(id);


--
-- Name: approval_requests approval_requests_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: audit_log audit_log_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: board_decision_view board_decision_view_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_decision_view
    ADD CONSTRAINT board_decision_view_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: board_project_cache board_project_cache_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_project_cache
    ADD CONSTRAINT board_project_cache_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: capital_balances capital_balances_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_balances
    ADD CONSTRAINT capital_balances_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: capital_events capital_events_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_events
    ADD CONSTRAINT capital_events_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: command_center_inquiries command_center_inquiries_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.command_center_inquiries
    ADD CONSTRAINT command_center_inquiries_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: committee_decisions committee_decisions_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.committee_decisions
    ADD CONSTRAINT committee_decisions_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: committee_decisions committee_decisions_selected_consultant_id_consultants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.committee_decisions
    ADD CONSTRAINT committee_decisions_selected_consultant_id_consultants_id_fk FOREIGN KEY (selected_consultant_id) REFERENCES public.consultants(id);


--
-- Name: competitor_projects competitor_projects_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_projects
    ADD CONSTRAINT competitor_projects_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: conflict_records conflict_records_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conflict_records
    ADD CONSTRAINT conflict_records_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: conflict_records conflict_records_source_a_id_source_registry_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conflict_records
    ADD CONSTRAINT conflict_records_source_a_id_source_registry_id_fk FOREIGN KEY (source_a_id) REFERENCES public.source_registry(id);


--
-- Name: conflict_records conflict_records_source_b_id_source_registry_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conflict_records
    ADD CONSTRAINT conflict_records_source_b_id_source_registry_id_fk FOREIGN KEY (source_b_id) REFERENCES public.source_registry(id);


--
-- Name: construction_milestones construction_milestones_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_milestones
    ADD CONSTRAINT construction_milestones_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: consultant_financials consultant_financials_consultant_id_consultants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultant_financials
    ADD CONSTRAINT consultant_financials_consultant_id_consultants_id_fk FOREIGN KEY (consultant_id) REFERENCES public.consultants(id) ON DELETE CASCADE;


--
-- Name: consultant_financials consultant_financials_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultant_financials
    ADD CONSTRAINT consultant_financials_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: contracts contracts_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: draft_decisions draft_decisions_agent_id_ai_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_decisions
    ADD CONSTRAINT draft_decisions_agent_id_ai_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id);


--
-- Name: draft_decisions draft_decisions_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_decisions
    ADD CONSTRAINT draft_decisions_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: draft_decisions draft_decisions_proposal_id_reconciliation_proposals_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_decisions
    ADD CONSTRAINT draft_decisions_proposal_id_reconciliation_proposals_id_fk FOREIGN KEY (proposal_id) REFERENCES public.reconciliation_proposals(id);


--
-- Name: draft_decisions draft_decisions_run_id_agent_runs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_decisions
    ADD CONSTRAINT draft_decisions_run_id_agent_runs_id_fk FOREIGN KEY (run_id) REFERENCES public.agent_runs(id);


--
-- Name: evaluator_scores evaluator_scores_consultant_id_consultants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluator_scores
    ADD CONSTRAINT evaluator_scores_consultant_id_consultants_id_fk FOREIGN KEY (consultant_id) REFERENCES public.consultants(id) ON DELETE CASCADE;


--
-- Name: evaluator_scores evaluator_scores_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluator_scores
    ADD CONSTRAINT evaluator_scores_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: expenses expenses_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: extraction_fields extraction_fields_extraction_run_id_extraction_runs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction_fields
    ADD CONSTRAINT extraction_fields_extraction_run_id_extraction_runs_id_fk FOREIGN KEY (extraction_run_id) REFERENCES public.extraction_runs(id);


--
-- Name: extraction_runs extraction_runs_agent_run_id_agent_runs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction_runs
    ADD CONSTRAINT extraction_runs_agent_run_id_agent_runs_id_fk FOREIGN KEY (agent_run_id) REFERENCES public.agent_runs(id);


--
-- Name: extraction_runs extraction_runs_document_id_project_documents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction_runs
    ADD CONSTRAINT extraction_runs_document_id_project_documents_id_fk FOREIGN KEY (document_id) REFERENCES public.project_documents(id);


--
-- Name: feasibility_studies feasibility_studies_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feasibility_studies
    ADD CONSTRAINT feasibility_studies_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: governance_gates governance_gates_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_gates
    ADD CONSTRAINT governance_gates_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: ipcs ipcs_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipcs
    ADD CONSTRAINT ipcs_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: leadership_directives leadership_directives_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leadership_directives
    ADD CONSTRAINT leadership_directives_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: messages messages_conversation_id_conversations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_conversations_id_fk FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: payment_plans payment_plans_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_assumptions project_assumptions_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assumptions
    ADD CONSTRAINT project_assumptions_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_assumptions project_assumptions_source_id_source_registry_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assumptions
    ADD CONSTRAINT project_assumptions_source_id_source_registry_id_fk FOREIGN KEY (source_id) REFERENCES public.source_registry(id);


--
-- Name: project_budget_items project_budget_items_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_budget_items
    ADD CONSTRAINT project_budget_items_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_cash_flows project_cash_flows_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_cash_flows
    ADD CONSTRAINT project_cash_flows_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_consultants project_consultants_consultant_id_consultants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_consultants
    ADD CONSTRAINT project_consultants_consultant_id_consultants_id_fk FOREIGN KEY (consultant_id) REFERENCES public.consultants(id) ON DELETE CASCADE;


--
-- Name: project_consultants project_consultants_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_consultants
    ADD CONSTRAINT project_consultants_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_documents project_documents_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT project_documents_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_financials project_financials_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_financials
    ADD CONSTRAINT project_financials_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_scenarios project_scenarios_feasibility_study_id_feasibility_studies_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_scenarios
    ADD CONSTRAINT project_scenarios_feasibility_study_id_feasibility_studies_id_f FOREIGN KEY (feasibility_study_id) REFERENCES public.feasibility_studies(id);


--
-- Name: project_scenarios project_scenarios_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_scenarios
    ADD CONSTRAINT project_scenarios_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_state_transitions project_state_transitions_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_state_transitions
    ADD CONSTRAINT project_state_transitions_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_tasks project_tasks_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: proposal_items proposal_items_proposal_id_reconciliation_proposals_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_items
    ADD CONSTRAINT proposal_items_proposal_id_reconciliation_proposals_id_fk FOREIGN KEY (proposal_id) REFERENCES public.reconciliation_proposals(id);


--
-- Name: recommendations recommendations_agent_id_ai_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT recommendations_agent_id_ai_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id);


--
-- Name: recommendations recommendations_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT recommendations_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: recommendations recommendations_run_id_agent_runs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT recommendations_run_id_agent_runs_id_fk FOREIGN KEY (run_id) REFERENCES public.agent_runs(id);


--
-- Name: reconciliation_ledger reconciliation_ledger_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_ledger
    ADD CONSTRAINT reconciliation_ledger_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: reconciliation_proposals reconciliation_proposals_agent_id_ai_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_proposals
    ADD CONSTRAINT reconciliation_proposals_agent_id_ai_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id);


--
-- Name: reconciliation_proposals reconciliation_proposals_document_id_project_documents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_proposals
    ADD CONSTRAINT reconciliation_proposals_document_id_project_documents_id_fk FOREIGN KEY (document_id) REFERENCES public.project_documents(id);


--
-- Name: reconciliation_proposals reconciliation_proposals_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_proposals
    ADD CONSTRAINT reconciliation_proposals_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: reconciliation_proposals reconciliation_proposals_run_id_agent_runs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_proposals
    ADD CONSTRAINT reconciliation_proposals_run_id_agent_runs_id_fk FOREIGN KEY (run_id) REFERENCES public.agent_runs(id);


--
-- Name: regulatory_dependencies regulatory_dependencies_depends_on_node_id_regulatory_nodes_id_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_dependencies
    ADD CONSTRAINT regulatory_dependencies_depends_on_node_id_regulatory_nodes_id_ FOREIGN KEY (depends_on_node_id) REFERENCES public.regulatory_nodes(id);


--
-- Name: regulatory_dependencies regulatory_dependencies_node_id_regulatory_nodes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_dependencies
    ADD CONSTRAINT regulatory_dependencies_node_id_regulatory_nodes_id_fk FOREIGN KEY (node_id) REFERENCES public.regulatory_nodes(id);


--
-- Name: regulatory_nodes regulatory_nodes_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_nodes
    ADD CONSTRAINT regulatory_nodes_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: report_versions report_versions_feasibility_study_id_feasibility_studies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_versions
    ADD CONSTRAINT report_versions_feasibility_study_id_feasibility_studies_id_fk FOREIGN KEY (feasibility_study_id) REFERENCES public.feasibility_studies(id);


--
-- Name: report_versions report_versions_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_versions
    ADD CONSTRAINT report_versions_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: risk_scores risk_scores_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_scores
    ADD CONSTRAINT risk_scores_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: sales_units sales_units_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_units
    ADD CONSTRAINT sales_units_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: transactions transactions_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: transactions transactions_wallet_id_wallets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_wallet_id_wallets_id_fk FOREIGN KEY (wallet_id) REFERENCES public.wallets(id);


--
-- Name: variation_orders variation_orders_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variation_orders
    ADD CONSTRAINT variation_orders_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: wallets wallets_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- PostgreSQL database dump complete
--

\unrestrict Ehcueqol7NpvsIIwqQgT6epS8kkfq2M8Zk7rkg2mQTvSpi4e9HRDdTYrQxX4b60

