import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
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
  ArrowRight,
  FolderOpen,
  ChevronRight,
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useState, useMemo, useCallback } from "react";

interface BreadcrumbItem {
  id: string;
  name: string;
}

function getFileIcon(mimeType: string, size: "sm" | "lg" = "sm") {
  const cls = size === "lg" ? "w-8 h-8" : "w-5 h-5";
  if (mimeType === "application/vnd.google-apps.folder") return <Folder className={`${cls} text-amber-500`} />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <FileSpreadsheet className={`${cls} text-green-600`} />;
  if (mimeType.includes("image") || mimeType.includes("dwg")) return <FileImage className={`${cls} text-purple-500`} />;
  if (mimeType.includes("pdf")) return <FileText className={`${cls} text-red-500`} />;
  if (mimeType.includes("document") || mimeType.includes("word")) return <FileText className={`${cls} text-blue-500`} />;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return <FileText className={`${cls} text-orange-500`} />;
  if (mimeType.includes("html")) return <FileText className={`${cls} text-teal-500`} />;
  return <File className={`${cls} text-gray-500`} />;
}

function getFileTypeName(mimeType: string): string {
  if (mimeType === "application/vnd.google-apps.folder") return "مجلد";
  if (mimeType === "application/vnd.google-apps.document") return "مستند Google";
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "جدول بيانات";
  if (mimeType === "application/vnd.google-apps.presentation") return "عرض تقديمي";
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("image") || mimeType.includes("dwg")) return "صورة / رسم";
  if (mimeType.includes("word")) return "Word";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "Excel";
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return "PowerPoint";
  if (mimeType.includes("html")) return "HTML";
  return "ملف";
}

function formatFileSize(bytes?: string): string {
  if (!bytes) return "";
  const size = parseInt(bytes);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
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
    enabled: isAuthenticated && !currentFolderId && !isSearching,
    staleTime: 30000,
  });

  // Files in current folder
  const folderInput = useMemo(
    () => (currentFolderId ? { folderId: currentFolderId } : null),
    [currentFolderId]
  );
  const filesQuery = trpc.drive.listFiles.useQuery(folderInput!, {
    enabled: isAuthenticated && !!currentFolderId && !isSearching,
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
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">جاري التحميل...</p>
        </div>
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

  const isLoading = isSearching
    ? searchResults.isLoading
    : currentFolderId
    ? filesQuery.isLoading
    : sharedQuery.isLoading;

  const currentItems = isSearching
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
  const folders = currentItems.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
  const regularFiles = currentItems.filter((f) => f.mimeType !== "application/vnd.google-apps.folder");

  // Current location name
  const currentLocationName = breadcrumbs.length > 0
    ? breadcrumbs[breadcrumbs.length - 1].name
    : "المجلدات المشتركة";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex justify-between items-center mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              <ArrowRight className="w-4 h-4 ml-1" />
              الرئيسية
            </Button>
            <div className="flex items-center gap-2 text-sm text-blue-100">
              {connectionQuery.data?.connected ? (
                <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-300" />
                  متصل — {connectionQuery.data.sharedFilesCount} ملف
                </span>
              ) : connectionQuery.isLoading ? (
                <span className="bg-white/10 px-3 py-1 rounded-full">جاري التحقق...</span>
              ) : (
                <span className="flex items-center gap-1.5 bg-red-500/20 px-3 py-1 rounded-full">
                  <XCircle className="w-3.5 h-3.5 text-red-300" />
                  غير متصل
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <HardDrive className="w-7 h-7" />
            <h1 className="text-xl font-bold">مستعرض الملفات — Google Drive</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-4">
        {/* Breadcrumbs Navigation */}
        <div className="bg-white rounded-xl border shadow-sm px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap text-sm">
              <button
                onClick={() => navigateToBreadcrumb(-1)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                  breadcrumbs.length === 0
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-blue-600 hover:bg-blue-50"
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                الرئيسية
              </button>
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.id} className="flex items-center gap-1.5">
                  <ChevronLeft className="w-3.5 h-3.5 text-gray-300" />
                  <button
                    onClick={() => navigateToBreadcrumb(index)}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      index === breadcrumbs.length - 1
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-blue-600 hover:bg-blue-50"
                    }`}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {currentFolderId && (
                <Button onClick={navigateBack} variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                  <ChevronRight className="w-4 h-4 ml-1" />
                  رجوع
                </Button>
              )}
              <Button
                onClick={() => {
                  if (currentFolderId) filesQuery.refetch();
                  else sharedQuery.refetch();
                }}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-gray-600"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-xl border shadow-sm px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="البحث في الملفات والمجلدات..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length < 2) setIsSearching(false);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pr-10 border-gray-200"
              />
            </div>
            <Button onClick={handleSearch} disabled={searchQuery.length < 2} size="sm">
              <Search className="w-4 h-4 ml-1" />
              بحث
            </Button>
            {isSearching && (
              <Button onClick={clearSearch} variant="outline" size="sm">
                إلغاء
              </Button>
            )}
          </div>
        </div>

        {/* Search Results Badge */}
        {isSearching && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              نتائج البحث عن "{searchQuery}"
              {searchResults.data && ` — ${searchResults.data.length} نتيجة`}
            </Badge>
          </div>
        )}

        {/* Current Location Title */}
        {!isSearching && (
          <div className="flex items-center gap-2 px-1">
            <FolderOpen className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-800">{currentLocationName}</h2>
            {!isLoading && (
              <span className="text-sm text-gray-400">
                ({folders.length} مجلد{regularFiles.length > 0 ? ` · ${regularFiles.length} ملف` : ""})
              </span>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && currentItems.length === 0 && !isSearching && (
          <div className="bg-white rounded-xl border shadow-sm py-16 text-center">
            <Folder className="w-16 h-16 mx-auto text-gray-200 mb-4" />
            <h3 className="text-lg font-medium text-gray-500 mb-1">
              {currentFolderId ? "هذا المجلد فارغ" : "لا توجد مجلدات مشتركة"}
            </h3>
            <p className="text-gray-400 text-sm">
              {currentFolderId
                ? "لم يتم العثور على ملفات أو مجلدات هنا"
                : "تأكد من مشاركة المجلدات مع حساب الخدمة"}
            </p>
          </div>
        )}

        {/* Folders Grid */}
        {!isLoading && folders.length > 0 && (
          <div>
            {regularFiles.length > 0 && (
              <p className="text-xs font-medium text-gray-400 mb-2 px-1 uppercase tracking-wider">
                المجلدات
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => navigateToFolder(folder.id, folder.name)}
                  className="bg-white rounded-xl border shadow-sm p-4 text-right hover:shadow-md hover:border-amber-300 transition-all group cursor-pointer w-full"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-amber-50 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                      <Folder className="w-6 h-6 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-800 truncate">{folder.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">مجلد</p>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-gray-300 group-hover:text-amber-500 transition-colors shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Files List */}
        {!isLoading && regularFiles.length > 0 && (
          <div>
            {folders.length > 0 && (
              <p className="text-xs font-medium text-gray-400 mb-2 px-1 uppercase tracking-wider mt-4">
                الملفات
              </p>
            )}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_100px_120px_40px] gap-2 px-4 py-2.5 bg-gray-50 border-b text-xs font-medium text-gray-500">
                <span>الاسم</span>
                <span className="text-center">الحجم</span>
                <span className="text-center">التاريخ</span>
                <span></span>
              </div>
              {/* File rows */}
              <div className="divide-y divide-gray-100">
                {regularFiles.map((file) => (
                  <div
                    key={file.id}
                    className="grid grid-cols-[1fr_100px_120px_40px] gap-2 items-center px-4 py-3 hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                        {getFileIcon(file.mimeType)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">{getFileTypeName(file.mimeType)}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 text-center">{formatFileSize(file.size)}</span>
                    <span className="text-xs text-gray-500 text-center">{formatDate(file.modifiedTime)}</span>
                    <div className="flex justify-center">
                      {file.webViewLink && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(file.webViewLink, "_blank");
                          }}
                          className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="فتح في Google Drive"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Search empty state */}
        {isSearching && !searchResults.isLoading && (searchResults.data?.length === 0) && (
          <div className="bg-white rounded-xl border shadow-sm py-16 text-center">
            <Search className="w-12 h-12 mx-auto text-gray-200 mb-4" />
            <h3 className="text-lg font-medium text-gray-500 mb-1">لا توجد نتائج</h3>
            <p className="text-gray-400 text-sm">لم يتم العثور على ملفات تطابق "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
