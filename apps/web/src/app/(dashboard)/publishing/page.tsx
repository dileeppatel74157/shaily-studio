"use client";

import React, { useState } from "react";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@shaily/ui";
import { Share2, Clock, CheckCircle2, AlertCircle, FileVideo, Plus, Save } from "lucide-react";

interface UploadJob {
  id: string;
  title: string;
  platform: string;
  status: "published" | "scheduled" | "uploading" | "failed";
  publishDate: string;
}

export default function PublishingCenter() {
  const [jobs, setJobs] = useState<UploadJob[]>([
    { id: "pub-1", title: "History of Jabalpur Documentary", platform: "YouTube", status: "published", publishDate: "Aug 02, 2026, 12:45 PM" },
    { id: "pub-2", title: "Unsolved Mysteries of Madan Mahal Fort", platform: "YouTube", status: "scheduled", publishDate: "Aug 09, 2026, 06:00 PM" },
    { id: "pub-3", title: "Daily Tech Bytes Recap", platform: "YouTube", status: "failed", publishDate: "Failed to upload (Size mismatch)" }
  ]);

  const [overrideTitle, setOverrideTitle] = useState("");
  const [overrideDesc, setOverrideDesc] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");

  const handleOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideTitle.trim()) return;

    const newJob: UploadJob = {
      id: `pub-${Date.now()}`,
      title: overrideTitle,
      platform: "YouTube",
      status: "scheduled",
      publishDate: scheduleDate ? new Date(scheduleDate).toLocaleString() : "Immediate upload"
    };

    setJobs((prev) => [newJob, ...prev]);
    setOverrideTitle("");
    setOverrideDesc("");
    setScheduleDate("");
  };

  const getStatusBadge = (status: UploadJob["status"]) => {
    switch (status) {
      case "published":
        return <span className="text-2xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle2 size={10} /> Published</span>;
      case "scheduled":
        return <span className="text-2xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded flex items-center gap-1"><Clock size={10} /> Scheduled</span>;
      default:
        return <span className="text-2xs bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded flex items-center gap-1"><AlertCircle size={10} /> Failed</span>;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Upload Queue Monitor */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-100">Publishing Dashboard</h3>
          <p className="text-zinc-400 text-sm mt-1">
            Monitor and schedule automatic uploads to linked channel networks.
          </p>
        </div>

        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id} className="bg-zinc-900/30 border-zinc-850">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-zinc-950 border border-zinc-850 flex items-center justify-center text-zinc-400">
                    <FileVideo size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-250 leading-tight">{job.title}</h4>
                    <p className="text-3xs text-zinc-500 mt-1 flex items-center gap-1">
                      <span>Platform: {job.platform}</span> • <span>Release: {job.publishDate}</span>
                    </p>
                  </div>
                </div>

                <div>
                  {getStatusBadge(job.status)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Upload Schedule Planner Form */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-100">Manual Publisher</h3>
          <p className="text-zinc-400 text-sm mt-1">Override target parameters.</p>
        </div>

        <Card className="bg-zinc-900/30 border-zinc-800">
          <CardHeader className="p-6 border-b border-zinc-850">
            <CardTitle className="text-sm font-semibold flex items-center space-x-2">
              <Share2 size={16} className="text-violet-400" />
              <span>Metadata & Schedule Overrides</span>
            </CardTitle>
            <CardDescription className="text-2xs">
              Override automatically generated titles or set target upload times.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-2xs text-zinc-450 font-bold uppercase tracking-wider block">
                  Override Video Title
                </label>
                <input
                  type="text"
                  value={overrideTitle}
                  onChange={(e) => setOverrideTitle(e.target.value)}
                  placeholder="e.g. Jabalpur History - Custom Cut"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-2xs text-zinc-455 font-bold uppercase tracking-wider block">
                  Override Description
                </label>
                <textarea
                  value={overrideDesc}
                  onChange={(e) => setOverrideDesc(e.target.value)}
                  placeholder="Provide description override template..."
                  rows={4}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-2xs text-zinc-455 font-bold uppercase tracking-wider block">
                  Target Publish Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs flex items-center justify-center gap-2 h-10 rounded-lg"
                disabled={!overrideTitle.trim()}
              >
                <Save size={14} />
                <span>Save & Stage Publish</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
