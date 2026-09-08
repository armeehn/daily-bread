%% dailybread.cls — one A5 page per \begin{page}, typeset from the same
%% semantic macros tools/latex/dblatex/reader.py parses for the web.
%%
%% Built on riposte-latex (RL-BRAND-001): colours, rules, chips. Daily Bread's
%% palette IS the Riposte palette (pink/marigold/teal on ink and bone), so the
%% brand package is loaded for everything but the face: the magazine's face is
%% IBM Plex Mono, riposte's is JetBrains Mono, so the font is set here.
%% Without riposte.sty on TEXINPUTS a minimal shim keeps the class compiling;
%% the geometry checks in CI do not depend on the brand layer.
%%
%% MACRO SET (the reader understands exactly this; anything else is an error)
%%   \issue{} \theme{} \edition{} \trim{}          issue metadata
%%   \begin{page}{id}{Template}[variant] … \end{page}
%%   \slug{}  \chrome{key}{value}                  page identity + running chrome
%%   \field{name}{value}                           any string prop
%%   \headline{} \kicker{} \standfirst{} \byline{} \pullquote{}
%%                                                 sugar for title/kicker/dek/byline/quote
%%   \begin{seq}{name} \block{…} … \end{seq}      a block sequence
%%   \begin{body} … \end{body}                     sugar for seq{body}
%%
%% Values are stored, not typeset, until \end{page}; the template renderer
%% then lays them out. Every page is one fixed-height box, so the page count
%% equals the number of \begin{page}s no matter what the content does.
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{dailybread}[2026/09/08 v0.1 Daily Bread issue]

\RequirePackage{kvoptions}
\SetupKeyvalOptions{family=db,prefix=db@}
\DeclareStringOption[fonts/]{fontpath}
\ProcessKeyvalOptions*
\LoadClass[10pt]{article}

\RequirePackage{etoolbox}
\RequirePackage{xstring}
\RequirePackage{xcolor}

% ---------------------------------------------------------------------------
% BRAND LAYER
% ---------------------------------------------------------------------------
\IfFileExists{riposte.sty}{%
  \edef\db@ripopts{field=bone,font=none,fontpath=\db@fontpath}%
  \expandafter\RequirePackage\expandafter[\db@ripopts]{riposte}%
}{%
  \ClassWarning{dailybread}{riposte.sty not found; brand layer shimmed}%
  \definecolor{RipInk}{HTML}{1D1A17}
  \definecolor{RipBone}{HTML}{F6F1E7}
  \definecolor{RipPink}{HTML}{F0477D}
  \definecolor{RipOrange}{HTML}{FE9A0D}
  \definecolor{RipTeal}{HTML}{12B795}
  \colorlet{RipText}{RipInk}
  \colorlet{RipTextMuted}{RipInk!65!RipBone}
  \colorlet{RipLine}{RipInk}
  \pagecolor{RipBone}\color{RipText}
  \newcommand{\riprule}{\par\noindent{\color{RipLine}\rule{\linewidth}{1.5pt}}\par}
  \newcommand{\ripdashrule}{\par\noindent{\color{RipTextMuted}\rule{\linewidth}{0.4pt}}\par}
}

% The face. IBM Plex Mono by name (fontconfig), by file (TeX Live ships it),
% then the bundled JetBrains Mono, then whatever fontspec has.
\RequirePackage{fontspec}
\defaultfontfeatures{Ligatures=TeX}
% The kit's glyph set (◦ ▸ ✕ ✂ ☐) is not in Plex Mono; DejaVu Sans fills in.
\ifcsname directlua\endcsname
  \directlua{luaotfload.add_fallback("dbglyphs", {"DejaVu Sans:mode=harf;"})}
  \defaultfontfeatures{Ligatures=TeX, RawFeature={fallback=dbglyphs}}
\fi
\IfFontExistsTF{IBM Plex Mono}{\setmainfont{IBM Plex Mono}}{%
  \IfFontExistsTF{IBMPlexMono-Regular.otf}{%
    \setmainfont{IBMPlexMono}[Extension=.otf,UprightFont=*-Regular,BoldFont=*-Bold,
      ItalicFont=*-Italic,BoldItalicFont=*-BoldItalic]}{%
    \IfFileExists{\db@fontpath JetBrainsMono-Regular.ttf}{%
      \setmainfont{JetBrainsMono}[Path=\db@fontpath,Extension=.ttf,
        UprightFont=*-Regular,BoldFont=*-Bold,ItalicFont=*-Italic]}{%
      \ClassWarning{dailybread}{no monospace brand face found}}}}
\renewcommand{\familydefault}{\rmdefault}

% ---------------------------------------------------------------------------
% GEOMETRY — A5 trim, the size every template is drawn at (db-render/*.dc.html
% at 561x794 px @ 96 dpi = 420 x 594.96 bp, which is what the press PDFs measure)
% ---------------------------------------------------------------------------
\RequirePackage[paperwidth=420bp,paperheight=594.96bp,
  top=8mm,bottom=8mm,inner=13mm,outer=10mm]{geometry}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\raggedright
\raggedbottom

% Type ladder, tuned so the longest page (~3000 characters) fits one A5.
\newcommand{\db@xs}{\fontsize{6pt}{7.5pt}\selectfont}
\newcommand{\db@label}{\fontsize{6.5pt}{8pt}\selectfont\bfseries}
\newcommand{\db@bodysize}{\fontsize{7.8pt}{9.9pt}\selectfont}
\newcommand{\db@leadsize}{\fontsize{8.5pt}{10.5pt}\selectfont\bfseries}
\newcommand{\db@hsize}{\fontsize{17pt}{18.5pt}\selectfont\bfseries}
\newcommand{\db@wordmarksize}{\fontsize{30pt}{32pt}\selectfont\bfseries}
\newlength{\db@gap}\setlength{\db@gap}{2.2mm}

% ---------------------------------------------------------------------------
% METADATA
% ---------------------------------------------------------------------------
\newcommand{\issue}[1]{\gdef\db@issue{#1}}
\newcommand{\theme}[1]{\gdef\db@theme{#1}}
\newcommand{\edition}[1]{\gdef\db@edition{#1}}
\newcommand{\trim}[1]{\gdef\db@trim{#1}}
\issue{}\theme{}\edition{}\trim{A5}

% ---------------------------------------------------------------------------
% STORAGE — props live in \db@p@<name>; a block sequence is \db@p@<name>@<i>
% with its count in \db@n@<name>. \db@names lists what was set so a page can
% be cleared and so \db@rest can print anything a template did not place.
% ---------------------------------------------------------------------------
\newcommand{\db@undef}[1]{\csundef{db@p@#1}\csundef{db@n@#1}}
\newcommand{\db@reset}{%
  \ifdef\db@names{\forlistloop{\db@undef}{\db@names}}{}%
  \gdef\db@names{}\gdef\db@done{}\gdef\db@cnames{}%
  \ifdef\db@cnames{\forlistloop{\db@cundef}{\db@cnames}}{}%
  \gdef\db@slug{}}
\newcommand{\db@cundef}[1]{\csundef{db@c@#1}}

\NewDocumentEnvironment{page}{m m O{}}
  {\db@reset\gdef\db@id{#1}\gdef\db@template{#2}\gdef\db@variant{#3}}
  {\db@emit}

\newcommand{\slug}[1]{\gdef\db@slug{#1}}
\newcommand{\chrome}[2]{\csgdef{db@c@#1}{#2}\listgadd\db@cnames{#1}}
\newcommand{\field}[2]{\csgdef{db@p@#1}{#2}\listgadd\db@names{#1}}
\newcommand{\headline}[1]{\field{title}{#1}}
\newcommand{\kicker}[1]{\field{kicker}{#1}}
\newcommand{\standfirst}[1]{\field{dek}{#1}}
\newcommand{\byline}[1]{\field{byline}{#1}}
\newcommand{\pullquote}[1]{\field{quote}{#1}}

\NewDocumentEnvironment{seq}{m}
  {\gdef\db@seqname{#1}\csnumgdef{db@n@#1}{0}\listgadd\db@names{#1}}{}
\NewDocumentEnvironment{body}{}{\begin{seq}{body}}{\end{seq}}
\newcommand{\block}[1]{%
  \csnumgdef{db@n@\db@seqname}{\csuse{db@n@\db@seqname}+1}%
  \csgdef{db@p@\db@seqname @\csuse{db@n@\db@seqname}}{#1}}

% ---------------------------------------------------------------------------
% RENDER HELPERS
% ---------------------------------------------------------------------------
% Run #2 once per value of prop #1 with the value in \db@item; a string is
% one value, a block sequence is each block. "none" and "" render nothing.
\newcommand{\db@each}[2]{%
  \ifcsdef{db@n@#1}{%
    \def\db@i{0}%
    \loop\ifnum\db@i<\csuse{db@n@#1}\relax
      \numdef\db@i{\db@i+1}%
      \letcs\db@item{db@p@#1@\db@i}%
      #2%
    \repeat
  }{%
    \letcs\db@item{db@p@#1}%
    \ifdefstring{\db@item}{none}{}{\ifdefempty{\db@item}{}{#2}}%
  }}

% \db@r{kind}{name}: render prop `name` as `kind` if it was set.
\newcommand{\db@r}[2]{%
  \ifboolexpr{test {\ifcsdef{db@p@#2}} or test {\ifcsdef{db@n@#2}}}%
    {\listgadd\db@done{#2}\csuse{db@k@#1}{#2}}{}}
\newcommand{\db@skip}[1]{\listgadd\db@done{#1}}

% Row "a | b | c": first field bold, the rest separated by a middle dot.
\newcommand{\db@rowline}{%
  \expandarg
  \IfSubStr{\db@item}{|}{%
    \StrCut{\db@item}{|}{\db@fa}{\db@fb}%
    \StrSubstitute{\db@fb}{|}{ · }[\db@fb]%
    {\bfseries\db@fa}\space\db@fb
  }{\db@item}\par}

\newcommand{\db@kindpara}[1]{{\db@bodysize\db@each{#1}{\db@item\par\vspace{0.5\db@gap}}}\vspace{0.5\db@gap}}
\newcommand{\db@kindnote}[1]{{\db@xs\color{RipTextMuted}\db@each{#1}{\db@item\par}}\vspace{0.5\db@gap}}
\newcommand{\db@kindmeta}[1]{{\db@xs\db@each{#1}{\db@item\par}}}
\newcommand{\db@kindlabel}[1]{{\db@label\color{RipTextMuted}\db@each{#1}{\db@item\par}}\vspace{0.4\db@gap}}
\newcommand{\db@kindhead}[1]{{\db@hsize\db@each{#1}{\db@item\par}}\vspace{\db@gap}}
\newcommand{\db@kindwordmark}[1]{{\db@wordmarksize\db@each{#1}{\db@item\par}}\vspace{\db@gap}}
\newcommand{\db@kindlead}[1]{{\db@leadsize\db@each{#1}{\db@item\par}}\vspace{\db@gap}}
\newcommand{\db@kindrows}[1]{{\db@bodysize\db@each{#1}{\db@rowline}}\vspace{0.5\db@gap}}
\newcommand{\db@kindquote}[1]{%
  {\db@leadsize\db@each{#1}{\hspace*{4mm}\parbox{\dimexpr\linewidth-4mm}{\raggedright“\db@item”}\par\vspace{0.6\db@gap}}}}
\newcommand{\db@kindlines}[1]{% poem: " / " is a line break, blocks are stanzas
  {\db@bodysize\db@each{#1}{\expandarg\StrSubstitute{\db@item}{ / }{\\}[\db@tmp]\db@tmp\par\vspace{0.8\db@gap}}}}
\newcommand{\db@kindqa}[1]{% "Q: …" bold, "A: …" plain
  {\db@bodysize\db@each{#1}{\expandarg\IfBeginWith{\db@item}{Q:}{{\bfseries\db@item}}{\db@item}\par\vspace{0.4\db@gap}}}}
\newcommand{\db@kindcheck}[1]{{\db@bodysize\db@each{#1}{[\ \ ]\ \db@item\par\vspace{0.3\db@gap}}}\vspace{0.5\db@gap}}
\newcommand{\db@kindpanels}[1]{% comic panels, numbered
  {\db@bodysize\def\db@pn{0}\db@each{#1}{\numdef\db@pn{\db@pn+1}\fbox{\parbox[c][14mm][c]{\dimexpr\linewidth-2\fboxsep-2\fboxrule}{\db@xs{\bfseries\db@pn}\ · \db@item}}\par\vspace{0.4\db@gap}}}\vspace{0.5\db@gap}}
\newcommand{\db@kindstamp}[1]{{\db@label\db@each{#1}{\fbox{\db@item}\par}}\vspace{\db@gap}}
\newcommand{\db@kindart}[1]{% an image slot: the placeholder box carries its label
  {\db@each{#1}{\fbox{\parbox[c][34mm][c]{\dimexpr\linewidth-2\fboxsep-2\fboxrule}{\centering\db@xs\color{RipTextMuted}\db@item}}\par}}\vspace{\db@gap}}
\newcommand{\db@kindphoto}[1]{% four photos share the width
  {\db@each{#1}{\fbox{\parbox[c][30mm][c]{\dimexpr0.5\linewidth-2\fboxsep-2\fboxrule-1mm}{\centering\db@xs\color{RipTextMuted}\db@item}}}}}
\csdef{db@k@para}{\db@kindpara}
\csdef{db@k@text}{\db@kindpara}
\csdef{db@k@note}{\db@kindnote}
\csdef{db@k@meta}{\db@kindmeta}
\csdef{db@k@label}{\db@kindlabel}
\csdef{db@k@head}{\db@kindhead}
\csdef{db@k@wordmark}{\db@kindwordmark}
\csdef{db@k@lead}{\db@kindlead}
\csdef{db@k@rows}{\db@kindrows}
\csdef{db@k@quote}{\db@kindquote}
\csdef{db@k@lines}{\db@kindlines}
\csdef{db@k@qa}{\db@kindqa}
\csdef{db@k@check}{\db@kindcheck}
\csdef{db@k@panels}{\db@kindpanels}
\csdef{db@k@stamp}{\db@kindstamp}
\csdef{db@k@art}{\db@kindart}
\csdef{db@k@photo}{\db@kindphoto}

% Anything a template did not place is still printed, small, so nothing in
% the source is silently absent from paper.
\newcommand{\db@restone}[1]{%
  \ifinlist{#1}{\db@done}{}{%
    {\db@xs\color{RipTextMuted}#1: }\db@kindmeta{#1}}}
\newcommand{\db@rest}{\vspace{\db@gap}\ripdashrule\forlistloop{\db@restone}{\db@names}}

% ---------------------------------------------------------------------------
% CHROME — running heads, accent rule, doc number, folio
% ---------------------------------------------------------------------------
\newcommand{\db@c}[1]{\ifcsdef{db@c@#1}{\csuse{db@c@#1}}{}}
\newcommand{\db@setaccent}{%
  \ifcsdef{db@c@accent}{%
    \letcs\db@acc{db@c@accent}\expandarg\StrRight{\db@acc}{6}[\db@hex]%
    \uppercase\expandafter{\expandafter\def\expandafter\db@hex\expandafter{\db@hex}}%
    \edef\db@tmp{\noexpand\definecolor{DBAccent}{HTML}{\db@hex}}\db@tmp
  }{\colorlet{DBAccent}{RipPink}}}
\newcommand{\db@header}{%
  \ifcsdef{db@c@headLeft}{%
    {\db@xs\bfseries\db@c{headLeft}\hfill\db@c{headRight}\par}%
    \vspace{0.8mm}\noindent{\color{DBAccent}\rule{\linewidth}{1.5pt}}\par
    \vspace{\db@gap}}{}}
\newcommand{\db@footer}{%
  \ifcsdef{db@c@docNo}{%
    \vspace{\db@gap}\riprule\vspace{0.6mm}%
    {\db@xs\bfseries\db@c{docNo}\hfill
      \ifdefstring{\db@variant}{}{}{\db@variant\ · }\db@c{folio}\par}}{}}

% ---------------------------------------------------------------------------
% THE PAGE — one fixed-height box, then a fresh sheet. Content that does not
% fit runs past the box (an "Overfull \vbox" in the log, which `check`
% reports) but can never add a page.
% ---------------------------------------------------------------------------
\newcommand{\db@emit}{%
  \db@setaccent
  \noindent\begin{minipage}[b][\textheight][t]{\textwidth}%
    \raggedright
    \db@header
    \ifcsdef{db@t@\db@template}{\csuse{db@t@\db@template}}{\db@t@generic}%
    \db@rest
    \vfill
    \db@footer
  \end{minipage}\clearpage}

% ---------------------------------------------------------------------------
% TEMPLATES — the order props are laid out, per template. Shared content bags
% (Letter, Contents, Interview, Lab, Colophon carry one bag across two pages)
% split by variant; the other half is \db@skip'ped so \db@rest stays quiet.
% ---------------------------------------------------------------------------
\csdef{db@t@generic}{%
  \db@r{label}{kicker}\db@r{head}{title}\db@r{lead}{dek}\db@r{meta}{byline}%
  \db@r{para}{body}}

\csdef{db@t@Cover}{%
  \db@r{label}{issueTag}\db@r{art}{art}\db@r{wordmark}{wordmark}%
  \db@r{meta}{edition}\db@r{para}{tagline}\db@r{stamp}{price}%
  \db@r{label}{publisher}\db@r{meta}{publisherLong}\db@r{meta}{issn}}

\csdef{db@t@Letter}{%
  \ifdefstring{\db@variant}{masthead}{%
    \db@r{wordmark}{wordmark}\db@r{label}{subtitle}\db@r{stamp}{stamp}%
    \db@r{label}{mastheadLabel}\db@r{rows}{masthead}\db@r{note}{ack}%
    \db@r{note}{funderLine}\db@r{note}{funderNote}%
    \db@skip{kicker}\db@skip{lead}\db@skip{title}\db@skip{body}\db@skip{signoff}%
  }{%
    \db@r{label}{kicker}\db@r{head}{lead}\db@r{head}{title}\db@r{para}{body}%
    \db@r{meta}{signoff}%
    \db@skip{wordmark}\db@skip{subtitle}\db@skip{stamp}\db@skip{mastheadLabel}%
    \db@skip{masthead}\db@skip{ack}\db@skip{funderLine}\db@skip{funderNote}}}

\csdef{db@t@Contents}{%
  \db@skip{scribble}%
  \ifdefstring{\db@variant}{contributors}{%
    \db@r{label}{whoTag}\db@r{para}{whoBlurb}\db@r{lead}{subTitle}\db@r{rows}{subRows}%
    \db@skip{title}\db@skip{manifestLabel}\db@skip{manifestTag}\db@skip{rows}\db@skip{footNote}%
  }{%
    \db@r{head}{title}\db@r{label}{manifestLabel}\db@r{meta}{manifestTag}%
    \db@r{rows}{rows}\db@r{note}{footNote}%
    \db@skip{whoTag}\db@skip{whoBlurb}\db@skip{subTitle}\db@skip{subRows}}}

\csdef{db@t@Feature}{%
  \db@skip{scribble}%
  \db@r{label}{kicker}\db@r{head}{title}\db@r{lead}{dek}\db@r{meta}{byline}%
  \db@r{art}{placeholder}\db@r{para}{body}\db@r{label}{boxTitle}\db@r{para}{boxBody}%
  \db@r{note}{caption}\db@r{note}{stats}\db@r{note}{contNote}}

\csdef{db@t@Body}{%
  \db@skip{scribble}\db@skip{scribble2}\db@skip{imgH}%
  \db@r{label}{kicker}\db@r{stamp}{stamp}\db@r{art}{placeholder}\db@r{note}{caption}%
  \db@r{label}{proseLabel}\db@r{para}{body}\db@r{para}{body2}%
  \db@r{quote}{quotes}\db@r{rows}{table}\db@r{para}{colA}\db@r{para}{colB}%
  \db@r{label}{checkTitle}\db@r{check}{checklist}%
  \db@r{note}{note}\db@r{label}{noteTag}\db@r{note}{note2}}

\csdef{db@t@Photo Essay}{%
  \db@r{head}{title}\db@r{lead}{dek}%
  \db@r{photo}{ph1}\db@r{photo}{ph2}\par\vspace{1mm}\db@r{photo}{ph3}\db@r{photo}{ph4}\par
  \vspace{\db@gap}\db@r{note}{capA}}

\csdef{db@t@Opinion}{%
  \db@skip{scribble}%
  \db@r{label}{tag}\db@r{head}{title}\db@r{meta}{meta}\db@r{para}{body}%
  \db@r{quote}{quote}\db@r{note}{promise}\db@r{note}{note}}

\csdef{db@t@Comic}{%
  \db@skip{scribble}%
  \db@r{label}{guestTag}\db@r{head}{title}\db@r{lead}{sub}\db@r{panels}{panels}%
  \db@r{para}{guestText}\db@r{para}{endText}\db@r{note}{endNote}\db@r{note}{credit}}

\csdef{db@t@Interview}{%
  \ifdefstring{\db@variant}{qa}{%
    \db@r{meta}{qLabel}\db@r{meta}{aLabel}\db@r{qa}{qa}\db@r{note}{footNote}%
    \db@skip{kicker}\db@skip{title}\db@skip{quote}\db@skip{placeholder}\db@skip{caption}%
  }{%
    \db@r{label}{kicker}\db@r{head}{title}\db@r{art}{placeholder}\db@r{note}{caption}%
    \db@r{quote}{quote}%
    \db@skip{qLabel}\db@skip{aLabel}\db@skip{qa}\db@skip{footNote}}}

\csdef{db@t@Poetry}{\db@skip{scribble}\db@r{label}{kicker}\db@r{lines}{poems}}

\csdef{db@t@Insert}{%
  \db@skip{scribble}%
  \db@r{label}{kicker}\db@r{head}{title}\db@r{meta}{edition}\db@r{para}{brief}%
  \db@r{label}{ripTag}\db@r{art}{placeholder}\db@r{label}{figLabel}%
  \db@r{rows}{stickers}\db@r{label}{crayonLabel}\db@r{note}{crayonNote}%
  \db@r{note}{credit}\db@r{para}{bio}\db@r{label}{submitTitle}\db@r{rows}{submitRows}%
  \db@r{label}{brand}\db@r{meta}{brandSub}}

\csdef{db@t@Lab}{%
  \ifdefstring{\db@variant}{status}{%
    \db@r{label}{statusLabel}\db@r{meta}{statusTag}\db@r{rows}{status}%
    \db@r{label}{whyTitle}\db@r{para}{whyBody}\db@r{note}{footNote}%
    \db@skip{stamp}\db@skip{logoSub}\db@skip{title}\db@skip{body}\db@skip{sig}%
  }{%
    \db@r{stamp}{stamp}\db@r{meta}{logoSub}\db@r{head}{title}\db@r{para}{body}%
    \db@r{note}{sig}%
    \db@skip{statusLabel}\db@skip{statusTag}\db@skip{status}\db@skip{whyTitle}%
    \db@skip{whyBody}\db@skip{footNote}}}

\csdef{db@t@Review}{%
  \db@skip{scribble}%
  \db@r{label}{kicker}\db@r{stamp}{stamp}\db@r{label}{brand}\db@r{meta}{brandSub}%
  \db@r{para}{blurb}\db@r{qa}{advice}\db@r{rows}{features}%
  \db@r{label}{rulesTag}\db@r{para}{rules}\db@r{rows}{cards}%
  \db@r{head}{rotTitle}\db@r{label}{rotLabel}\db@r{meta}{rotTag}\db@r{rows}{tracks}%
  \db@r{note}{qrNote}\db@r{note}{qrSub}}

\csdef{db@t@Listings}{%
  \db@skip{scribble}%
  \db@r{label}{kicker}\db@r{label}{dirKicker}\db@r{head}{title}\db@r{para}{intro}%
  \db@r{rows}{rows}\db@r{label}{boxLabel}\db@r{meta}{boxTag}\db@r{rows}{notes}%
  \db@r{label}{schedLabel}\db@r{meta}{schedTag}\db@r{note}{schedFoot}%
  \db@r{label}{bringTag}\db@r{para}{bring}%
  \db@r{label}{voteTitle}\db@r{rows}{votes}\db@r{note}{voteNote}%
  \db@r{label}{brand}\db@r{meta}{brandSub}\db@r{note}{qrNote}\db@r{note}{qrSub}%
  \db@r{note}{footNote}}

\csdef{db@t@Colophon}{%
  \ifdefstring{\db@variant}{ad}{%
    \db@r{head}{slogan}\db@r{art}{placeholder}\db@r{note}{caption}\db@r{para}{adText}%
    \db@skip{brand}\db@skip{creditsLabel}\db@skip{credits}\db@skip{colophon}\db@skip{sig}%
  }{%
    \db@r{label}{brand}\db@r{label}{creditsLabel}\db@r{rows}{credits}%
    \db@r{para}{colophon}\db@r{note}{sig}%
    \db@skip{slogan}\db@skip{placeholder}\db@skip{caption}\db@skip{adText}}}
