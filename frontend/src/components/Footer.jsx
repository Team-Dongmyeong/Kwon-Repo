export default function Footer() {
  return (
    <footer className="bg-ink px-4 pb-12 pt-16 text-white sm:px-6 sm:pb-16 sm:pt-20 lg:pb-[96px] lg:pt-24">
      <div className="mx-auto max-w-content">
        <h2 className="text-h2 text-canvas sm:text-h2-md">
          언제든, 대화로
          <br />
          시작할 수 있어요
        </h2>

        <div className="mt-12 flex flex-col gap-6 border-t border-white/15 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[20px] font-bold tracking-tight text-canvas">마음잇기</p>

          <nav aria-label="정책 링크">
            <ul className="flex flex-wrap gap-x-8 gap-y-3 text-footer text-white/70">
              <li>
                <a href="#" className="inline-flex min-h-[44px] items-center hover:text-white">
                  이용약관
                </a>
              </li>
              <li>
                <a href="#" className="inline-flex min-h-[44px] items-center hover:text-white">
                  개인정보처리방침
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <p className="mt-8 text-footer text-white/70">
          &copy; {new Date().getFullYear()} 마음잇기. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
