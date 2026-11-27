import { Component, useMemo, type ReactNode } from 'react';
import { DiscussionEmbed } from 'disqus-react';
import { MessageSquare } from 'lucide-react';

interface DisqusErrorBoundaryState {
  hasError: boolean;
}

class DisqusErrorBoundary extends Component<
  { children: ReactNode },
  DisqusErrorBoundaryState
> {
  state: DisqusErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): DisqusErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          Unable to load Disqus comments right now. Please check your connection or browser privacy
          settings.
        </div>
      );
    }
    return this.props.children;
  }
}

export function DisqusDiscussion() {
  const disqusConfig = useMemo(
    () => ({
      url: typeof window !== 'undefined' ? `${window.location.origin}/` : 'https://nutri-me.app/',
      identifier: 'nutri-me-community-discussion',
      title: 'nutri-me Community Discussion',
      language: 'en',
    }),
    []
  );

  return (
    <section
      aria-labelledby="community-discussion-heading"
      className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4"
    >
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center shrink-0">
          <MessageSquare className="w-4 h-4 text-emerald-700" />
        </div>
        <div>
          <h2 id="community-discussion-heading" className="text-base font-bold text-slate-900">
            Community Discussion
          </h2>
          <p className="text-xs text-slate-500">
            Share workout tips, recipe ideas, and nutrition questions with the nutri-me community.
          </p>
        </div>
      </div>

      <div className="min-h-[160px] bg-white text-[#0f172a]">
        <DisqusErrorBoundary>
          <DiscussionEmbed shortname="nutri-me" config={disqusConfig} />
        </DisqusErrorBoundary>
      </div>
    </section>
  );
}
