import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  ArrowRight,
  Folder,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Search,
  ChevronLeft,
  Home,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  FolderPlus,
  ArrowLeft,
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";

interface BreadcrumbItem {
  id: string;
  name: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType === "application/vnd.google-apps.folder") return <Folder className="w-5 h-5 text-amber-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
  if (mimeType.includes("image")) return <FileImage className="w-5 h-5 text-purple-500" />;
  if (mimeType.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
  if (mimeType.includes("document") || mimeType.includes("word")) return <FileText className="w-5 h-5 text-blue-500" />;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return <FileText className="w-5 h-5 text-orange-500" />;
  return <File className="w-5 h-5 text-gray-500" />;
}

function getFileTypeName(mimeType: string): string {
  if (mimeType === "application/vnd.google-apps.folder") return "مجلد";
  if (mimeType === "application/vnd.google-apps.document") return "مستند Google";
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "جدول بيانات Google";
  if (mimeType === "application/vnd.google-apps.presentation") return "عرض تقديمي Google";
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("image")) return "صورة";
  if (mimeType.includes("word")) return "مستند Word";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "جدول بيانات Excel";
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return "عرض تقديمي PowerPoint";
  if (mimeType.includes("zip") || mimeType.includes("rar")) return "ملف مضغوط";
  if (mimeType.includes("video")) return "فيديو";
  if (mimeType.includes("audio")) return "صوت";
  return "ملف";
}

function formatFileSize(bytes?: string): string {
  if (!bytes) return "—";
  const size = parseInt(bytes);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DriveBrowserPage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Connection status
  const connectionQuery = trpc.drive.verifyConnection.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60000,
  });

  // Shared folders (root level)
  const sharedQuery = trpc.drive.listShared.useQuery(undefined, {
    enabled: isAuthenticated && !currentFolderId,
    staleTime: 30000,
  });

  // Files in current folder
  const folderInput = useMemo(
    () => (currentFolderId ? { folderId: currentFolderId } : null),
    [currentFolderId]
  );
  const filesQuery = trpc.drive.listFiles.useQuery(folderInput!, {
    enabled: isAuthenticated && !!currentFolderId,
    staleTime: 15000,
  });

  // Search
  const searchInput = useMemo(
    () =>
      isSearching && searchQuery.length >= 2
        ? { query: searchQuery, folderId: currentFolderId || undefined }
        : null,
    [isSearching, searchQuery, currentFolderId]
  );
  const searchResults = trpc.drive.searchFiles.useQuery(searchInput!, {
    enabled: !!searchInput,
    staleTime: 10000,
  });

  const navigateToFolder = useCallback(
    (folderId: string, folderName: string) => {
      setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
      setCurrentFolderId(folderId);
      setIsSearching(false);
      setSearchQuery("");
    },
    []
  );

  const navigateBack = useCallback(() => {
    if (breadcrumbs.length <= 1) {
      setCurrentFolderId(null);
      setBreadcrumbs([]);
    } else {
      const newBreadcrumbs = breadcrumbs.slice(0, -1);
      setBreadcrumbs(newBreadcrumbs);
      setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
    }
    setIsSearching(false);
    setSearchQuery("");
  }, [breadcrumbs]);

  const navigateToBreadcrumb = useCallback(
    (index: number) => {
      if (index < 0) {
        setCurrentFolderId(null);
        setBreadcrumbs([]);
      } else {
        const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
        setBreadcrumbs(newBreadcrumbs);
        setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
      }
      setIsSearching(false);
      setSearchQuery("");
    },
    [breadcrumbs]
  );

  const handleSearch = useCallback(() => {
    if (searchQuery.length >= 2) {
      setIsSearching(true);
    }
  }, [searchQuery]);

  const clearSearch = useCallback(() => {
    setIsSearching(false);
    setSearchQuery("");
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl">مركز قيادة كومو</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-600">يجب تسجيل الدخول للوصول إلى الملفات</p>
            <Button onClick={() => (window.location.href = getLoginUrl())} className="w-full" size="lg">
              تسجيل الدخول
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = currentFolderId ? filesQuery.isLoading : sharedQuery.isLoading;
  const files = isSearching
    ? searchResults.data || []
    : currentFolderId
    ? filesQuery.data?.files || []
    : (sharedQuery.data || []).map((f) => ({
        ...f,
        size: undefined,
        modifiedTime: undefined,
        createdTime: undefined,
        parents: undefined,
        webViewLink: undefined,
        iconLink: undefined,
        thumbnailLink: undefined,
      }));

  // Separate folders and files
  const folders = files.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
  const regularFiles = files.filter((f) => f.mimeType !== "application/vnd.google-apps.folder");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="text-white hover:bg-white/20"
              >
                <ArrowRight className="w-4 h-4 ml-1" />
                الرئيسية
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <HardDrive className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">مستعرض الملفات — Google Drive</h1>
              <p className="text-blue-100 text-sm">
                {connectionQuery.data?.connected ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-green-300" />
                    متصل — {connectionQuery.data.sharedFilesCount} ملف مشترك
                  </span>
                ) : connectionQuery.isLoading ? (
                  "جاري التحقق من الاتصال..."
                ) : (
                  <span className="flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-red-300" />
                    غير متصل
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-4">
        {/* Breadcrumbs */}
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => navigateToBreadcrumb(-1)}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-sm"
              >
                <Home className="w-4 h-4" />
                المجلدات المشتركة
              </button>
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.id} className="flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4 text-gray-400" />
                  <button
                    onClick={() => navigateToBreadcrumb(index)}
                    className={`text-sm font-medium ${
                      index === breadcrumbs.length - 1
                        ? "text-gray-800"
                        : "text-blue-600 hover:text-blue-800"
                    }`}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search Bar */}
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="البحث في الملفات..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.length < 2) setIsSearching(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pr-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={searchQuery.length < 2} size="sm">
                <Search className="w-4 h-4 ml-1" />
                بحث
              </Button>
              {isSearching && (
                <Button onClick={clearSearch} variant="outline" size="sm">
                  إلغاء البحث
                </Button>
              )}
              {currentFolderId && (
                <Button onClick={navigateBack} variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 ml-1" />
                  رجوع
                </Button>
              )}
              <Button
                onClick={() => {
                  if (currentFolderId) {
                    filesQuery.refetch();
                  } else {
                    sharedQuery.refetch();
                  }
                }}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search Results Badge */}
        {isSearching && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              نتائج البحث عن "{searchQuery}"
              {searchResults.data && ` — ${searchResults.data.length} نتيجة`}
            </Badge>
          </div>
        )}

        {/* Loading State */}
        {(isLoading || (isSearching && searchResults.isLoading)) && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isSearching && files.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Folder className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">
                {currentFolderId ? "هذا المجلد فارغ" : "لا توجد مجلدات مشتركة"}
              </h3>
              <p className="text-gray-400 text-sm">
                {currentFolderId
                  ? "لم يتم العثور على ملفات في هذا المجلد"
                  : "تأكد من مشاركة المجلدات مع حساب الخدمة"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Folders Section */}
        {!isLoading && folders.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
              <Folder className="w-4 h-4" />
              المجلدات ({folders.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {folders.map((folder) => (
                <Card
                  key={folder.id}
                  className="cursor-pointer hover:shadow-md transition-all hover:border-amber-300"
                  onClick={() => navigateToFolder(folder.id, folder.name)}
                >
                  <CardContent className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                        <Folder className="w-6 h-6 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{folder.name}</p>
                        <p className="text-xs text-gray-400">مجلد</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Files Section */}
        {!isLoading && regularFiles.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
              <FileText className="w-4 h-4" />
              الملفات ({regularFiles.length})
            </h3>
            <Card>
              <div className="divide-y">
                {regularFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 py-3 px-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                      {getFileIcon(file.mimeType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{file.name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        <span>{getFileTypeName(file.mimeType)}</span>
                        {file.size && <span>{formatFileSize(file.size)}</span>}
                        {file.modifiedTime && <span>{formatDate(file.modifiedTime)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {file.webViewLink && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(file.webViewLink, "_blank");
                          }}
                          title="فتح في Google Drive"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
