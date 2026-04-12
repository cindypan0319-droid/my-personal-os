"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "../../../../components/app/PageHeader";

export default function ProjectAnalysisRedirectPage() {
  const params = useParams();
  const projectId = Number(params.id);

  return (
    <div className="page-wrap">
      <PageHeader
        kicker="Projects"
        title="Analysis"
        description="This project now uses the single-page workspace."
        actions={
          <Link href={`/projects/${projectId}`} className="primary-btn">
            Back to Project Workspace
          </Link>
        }
      />

      <section className="panel card-pad">
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          Analysis moved
        </div>
        <div className="task-meta" style={{ marginBottom: 12 }}>
          Open the project workspace and switch to the Analysis tab.
        </div>

        <Link href={`/projects/${projectId}`} className="blue-btn">
          Open Project Workspace
        </Link>
      </section>
    </div>
  );
}