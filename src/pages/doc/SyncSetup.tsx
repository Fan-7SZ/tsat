import {
  DocCallout,
  DocGroup,
  DocList,
  DocPageDescription,
  DocPageHeader,
  DocPageTitle,
  DocSectionContent,
  DocSectionImage,
  DocSectionTitle,
} from "@/components/style/DocStyle"
import { useLanguage } from "@/components/shared/language-provider"

export function SyncSetup() {
  const { language } = useLanguage()
  return language === "zh" ? <SyncSetupZh /> : <SyncSetupEn />
}

function SyncSetupEn() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>Sync Setup</DocPageTitle>
        <DocPageDescription>
          TSAT keeps your data on your device by default. Sync mirrors it
          through your own cloud drive so several devices stay in step — no
          account on our side, no server holding your tasks.
        </DocPageDescription>
      </DocPageHeader>
      <DocGroup>
        <DocSectionContent>
          <DocSectionTitle>How it works</DocSectionTitle>
          <p>
            Each device writes its own small data file into a hidden,
            app-private folder in <b>your</b> Google Drive or OneDrive. On every
            cycle a device reads the other devices' files, merges them with its
            own data, and writes its file back. That's the whole mechanism —
            your cloud account is the meeting point.
          </p>
          <DocCallout tone="info" title="Automatic, with a short delay">
            Once connected, sync runs about every minute, and again a moment
            after each edit. It isn't a live push, so expect up to a minute of
            lag — or press <b>Sync now</b> to force it.
          </DocCallout>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>Connect this device</DocSectionTitle>
          <p>
            Open <b>Settings → Sync</b> (or click the cloud icon in the home
            header).
          </p>
          <DocSectionImage src="/doc/sync-settings.png" alt="Sync settings" />
          <DocList ordered>
            <li>
              <b>Pick a provider</b> — choose <b>Google Drive</b> or{" "}
              <b>OneDrive</b> from the Provider dropdown.
            </li>
            <li>
              <b>Authorize</b> — click <b>Authorize</b> and complete the
              provider's sign-in. Grant offline access so TSAT can keep syncing
              in the background.
            </li>
            <li>
              <b>Done</b> — the panel now shows <b>Auto sync</b> and a{" "}
              <b>Last synced</b> time. Your data uploads on the next cycle.
            </li>
          </DocList>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>Add another device</DocSectionTitle>
          <p>
            On the second device, sign in to the <b>same</b> Google or Microsoft
            account, then repeat the steps above with the <b>same provider</b>.
            Its first sync finds the other device's file, merges it in, and both
            devices converge from then on.
          </p>
          <DocCallout
            tone="warning"
            title="Same cloud account, authorized separately"
          >
            Devices only see each other through one shared cloud account. Each
            device also has to be authorized on its own — the credential lives
            locally and is never synced.
          </DocCallout>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>How conflicts are resolved</DocSectionTitle>
          <p>
            Merging happens per record, not per file, so edits on different
            devices don't overwrite each other. When the same record is changed
            in
            two places, the most recent change wins.
          </p>
          <DocCallout tone="info" title="Deletions win by design">
            If one device deletes something and another only edited it, the
            deletion carries over. A removed item won't reappear just because you
            touched it elsewhere.
          </DocCallout>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>What is and isn't synced</DocSectionTitle>
          <p>
            Sync covers your <b>content</b> — goals, tasks, dependencies, tags,
            and activity history. Device preferences stay local and must be set
            on each device: your <b>theme</b>, <b>language</b>, and your{" "}
            <b>AI provider and API key</b>.
          </p>
          <DocCallout
            tone="note"
            title="You won't find the files in your drive"
          >
            The data lives in a hidden, app-scoped folder (Drive's App Data
            folder / the OneDrive app folder), so it won't clutter your normal
            file view. That's expected.
          </DocCallout>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>Disconnecting and the danger zone</DocSectionTitle>
          <p>
            To switch providers, disconnect first — the dropdown is locked while
            one is bound. <b>Disconnect</b> only signs this device out; your
            local data and the cloud backup stay put.
          </p>
          <DocCallout
            tone="danger"
            title="“Delete authorization & cloud backup” is global"
          >
            This wipes <b>every</b> device's file from the cloud, not just this
            one, and can't be undone. Each device's local data survives and will
            recreate its own file on the next sync, but the shared cloud history
            is gone.
          </DocCallout>
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}

function SyncSetupZh() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>同步设置</DocPageTitle>
        <DocPageDescription>
          TSAT
          默认把数据保留在你的设备上。同步功能借助你自己的网盘做镜像,让多台设备保持一致——我们不留存账号,也没有服务器保存你的任务。
        </DocPageDescription>
      </DocPageHeader>
      <DocGroup>
        <DocSectionContent>
          <DocSectionTitle>工作原理</DocSectionTitle>
          <p>
            每台设备把自己的一份小数据文件写进<b>你的</b> Google Drive 或
            OneDrive
            的应用专属隐藏目录。每个同步周期里,设备会读取其他设备的文件、与本地数据合并,再把自己的文件写回去。整个机制就是这样——你的网盘账号就是汇合点。
          </p>
          <DocCallout tone="info" title="自动同步,略有延迟">
            连接后,同步大约每分钟运行一次,每次编辑后片刻也会再运行一次。它不是实时推送,最多可能有一分钟左右的延迟——也可以点
            <b>立即同步</b>强制执行。
          </DocCallout>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>连接这台设备</DocSectionTitle>
          <p>
            打开<b>设置 → 同步</b>(或点击主页顶部的云朵图标)。
          </p>
          <DocSectionImage src="/doc/sync-settings.png" alt="Sync settings" />
          <DocList ordered>
            <li>
              <b>选择提供方</b>——在「同步提供方」下拉框里选择{" "}
              <b>Google Drive</b> 或 <b>OneDrive</b>。
            </li>
            <li>
              <b>授权</b>——点击<b>授权</b>
              按钮并完成提供方的登录。请授予离线访问权限,TSAT
              才能在后台持续同步。
            </li>
            <li>
              <b>完成</b>——面板会显示<b>自动同步</b>和<b>上次同步</b>
              时间,你的数据会在下个周期上传。
            </li>
          </DocList>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>添加另一台设备</DocSectionTitle>
          <p>
            在第二台设备上登录<b>同一个</b> Google 或 Microsoft 账号,然后用
            <b>同一个提供方</b>
            重复上面的步骤。它的第一次同步会发现另一台设备的文件并合并进来,此后两台设备就会持续收敛一致。
          </p>
          <DocCallout tone="warning" title="同一网盘账号,各自授权">
            设备之间只能通过同一个网盘账号看到彼此;每台设备也都要单独授权——凭据只存在本地,不参与同步。
          </DocCallout>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>冲突如何解决</DocSectionTitle>
          <p>
            合并按「记录」而不是按「文件」进行,不同设备上的编辑不会互相覆盖。同一条记录在两处都被修改时,以较新的修改为准。
          </p>
          <DocCallout tone="info" title="删除优先是有意设计">
            如果一台设备删除了某条数据,而另一台只是编辑过它,删除仍会传播下去。被删除的条目不会因为你在别处编辑过就重新出现。
          </DocCallout>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>哪些同步,哪些不同步</DocSectionTitle>
          <p>
            同步覆盖你的<b>内容</b>
            ——目标、任务、依赖、标签、活动历史。设备偏好保持本地,需要在每台设备上分别设置:
            <b>主题</b>、<b>语言</b>,以及
            <b>AI 服务商和 API 密钥</b>。
          </p>
          <DocCallout tone="note" title="在网盘里找不到这些文件是正常的">
            数据存放在应用专属的隐藏目录(Drive 的 App Data 目录 / OneDrive
            应用目录),不会出现在你平常的文件视图里——这是预期行为。
          </DocCallout>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>解绑与敏感操作</DocSectionTitle>
          <p>
            要更换提供方,先解除绑定——绑定期间下拉框是锁定的。
            <b>解除绑定</b>
            只是让这台设备退出登录;本地数据和云端备份都不受影响。
          </p>
          <DocCallout
            tone="danger"
            title="「删除授权并清空云端备份」是全局操作"
          >
            它会删除云端<b>所有</b>
            设备的文件,而不只是这台,且不可恢复。每台设备的本地数据仍在,下次同步会重新生成各自的文件,但共享的云端历史会随之丢失。
          </DocCallout>
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}
