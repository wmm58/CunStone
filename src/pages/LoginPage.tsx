import { useState, type FormEvent } from "react";

import {
  FIXED_TEST_CODE,
  isValidPhone,
  loginWithFixedCode,
  normalizePhone,
} from "../features/auth/authService";

interface LoginPageProps {
  onSuccess: () => void;
  storageNotice?: string;
}

export default function LoginPage({ onSuccess, storageNotice }: LoginPageProps) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  function handleRequestCode() {
    setCode(FIXED_TEST_CODE);
    setError("");
    setInfo("测试模式：验证码已填入，未发送短信");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");

    if (!isValidPhone(normalizePhone(phone))) {
      setError("请输入有效的 11 位手机号");
      return;
    }

    try {
      const result = loginWithFixedCode({ phone, code });
      if (!result.ok) {
        setError(result.error === "invalid-code" ? "验证码错误" : "手机号格式不正确");
        return;
      }
      onSuccess();
    } catch {
      setError("本地存储写入失败，请检查浏览器存储权限");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-300 bg-white p-8 shadow-sm">
        <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-slate-500">
          CUNSTONE · 本地原型
        </p>
        <h1 className="mb-2 text-2xl font-bold text-slate-950">登录 / 注册</h1>
        <p className="mb-6 text-sm leading-6 text-slate-600">
          使用手机号和固定测试验证码进入本地创作编辑页。
        </p>

        {storageNotice ? (
          <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {storageNotice}
          </p>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">手机号</span>
            <input
              autoComplete="tel"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
              inputMode="tel"
              name="phone"
              onChange={(event) => setPhone(event.target.value)}
              placeholder="13800138000"
              value={phone}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">验证码</span>
            <div className="flex gap-2">
              <input
                autoComplete="one-time-code"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                inputMode="numeric"
                name="code"
                onChange={(event) => setCode(event.target.value)}
                placeholder="测试验证码"
                value={code}
              />
              <button
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800"
                onClick={handleRequestCode}
                type="button"
              >
                获取测试验证码
              </button>
            </div>
          </label>

          {error ? (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          {info ? (
            <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {info}
            </p>
          ) : null}

          <button
            className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
            type="submit"
          >
            登录 / 注册
          </button>
        </form>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          本地演示能力：数据仅保存在当前浏览器，不代表真实账号安全体系。
        </p>
      </section>
    </main>
  );
}
