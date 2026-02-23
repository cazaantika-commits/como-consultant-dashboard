import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ExternalLink, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { getLoginUrl } from "@/const";

export default function GoogleConnectPage() {
  const { user, loading: authLoading } = useAuth();
  const [callbackProcessing, setCallbackProcessing] = useState(false);
  const [callbackResult, setCallbackResult] = useState<string | null>(null);

  const statusQuery = trpc.googleOAuth.getStatus.useQuery(undefined, {
    enabled: !!user,
  });

  const authUrlQuery = trpc.googleOAuth.getAuthUrl.useQuery(undefined, {
    enabled: !!user,
  });

  const handleCallbackMut = trpc.googleOAuth.handleCallback.useMutation({
    onSuccess: () => {
      setCallbackResult("success");
      setCallbackProcessing(false);
      statusQuery.refetch();
      window.history.replaceState({}, '', '/google-connect');
    },
    onError: (err) => {
      setCallbackResult(`error: ${err.message}`);
      setCallbackProcessing(false);
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code && user && !callbackProcessing && !callbackResult) {
      setCallbackProcessing(true);
      handleCallbackMut.mutate({ code });
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir="rtl">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>ربط Google Drive</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">يجب تسجيل الدخول أولاً</p>
            <a href={getLoginUrl()}>
              <Button className="w-full">تسجيل الدخول</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-xl">ربط Google Drive</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {callbackProcessing && (
            <div className="flex items-center gap-2 text-blue-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>جاري ربط الحساب...</span>
            </div>
          )}

          {callbackResult === "success" && (
            <div className="flex items-center gap-2 text-green-500 bg-green-50 p-3 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span>تم ربط Google Drive بنجاح!</span>
            </div>
          )}

          {callbackResult && callbackResult.startsWith("error") && (
            <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-lg">
              <XCircle className="w-5 h-5" />
              <span>خطأ: {callbackResult}</span>
            </div>
          )}

          {statusQuery.data?.connected ? (
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="w-6 h-6" />
                <span className="text-lg font-semibold">Google Drive مربوط</span>
              </div>
              <p className="text-sm text-muted-foreground">
                يمكنك الآن العودة والمتابعة
              </p>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                اضغط الزر أدناه لربط حسابك Google Drive. هذا مطلوب لنسخ وتسمية الملفات.
              </p>
              {authUrlQuery.data?.authUrl ? (
                <a href={authUrlQuery.data.authUrl}>
                  <Button className="w-full gap-2" size="lg">
                    <ExternalLink className="w-4 h-4" />
                    ربط Google Drive
                  </Button>
                </a>
              ) : (
                <Button disabled className="w-full">
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  جاري التحميل...
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
