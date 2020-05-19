/****************************************************************
 * URLS
 ****************************************************************/

var github_user = "markrtuttle";
var github_repo = "cbmc";

function run_url(runid) {
  return ["https://github.com", github_user, github_repo,
          "actions/runs", runid].join("/");
}

function artifacts_url() {
  return ["https://api.github.com/repos", github_user, github_repo,
          "actions/artifacts"].join("/");
}

/****************************************************************
 * An artifact name is a string of the form "OS VERSION TIMESTAMP SHA"
 ****************************************************************/

function parse_os(str) {
  if (str == null) { return null; }

  lc = str.toLowerCase();
  if (lc == "ubuntu16") { return "Ubuntu16"; }
  if (lc == "ubuntu18") { return "Ubuntu18"; }
  if (lc == "macos") { return "MacOS"; }
  if (lc == "windows") { return "Windows"; }

  return null;
}

function parse_osver(str) {
  if (str == null) { return null; }

  lc = str.toLowerCase();
  if (lc == "xenial") { return "xenial"; }
  if (lc == "bionic") { return "bionic"; }
  if (lc == "catalina") { return "catalina"; }
  if (lc == "vs2019") { return "vs2019"; }

  return null;
}

function parse_pkg(str) {
  if (str == null) { return null; }

  lc = str.toLowerCase();
  if (lc == "cbmc") { return "cbmc"; }
  if (lc == "cbmc-latest") { return "cbmc-latest"; }

  return null;
}

function parse_pkgver(str) {
  if (str == null) { return false; }
  if (str.match(/^\d+(.\d+)*-\d+$/g) != null) {
    return str
  }
  return null;
}

function parse_time(str) {
  if (str == null) { return false; }
  if (str.match(/^\d\d\d\d\d\d\d\dT\d\d\d\d\d\dZ$/g) != null) {
    return str;
  }
  return null;
}

function parse_sha(str) {
  if (str == null) { return false; }
  if (str.match(/^[\da-f]+$/gi) != null && str.length == 8) {
    return str;
  }
  return null;
}

function parse_runid(str) {
  if (str == null) { return null; }
  if (str.match(/^\d+$/gi) != null) { return str; }
  return null;
}

function parse_name(name){
  if (name == null) {
    return null;
  }

  parts = name.split(/\s+/);
  console.log(parts);


  // os pkg pkgver osver time sha

  os = parse_os(parts[0]);
  pkg = parse_pkg(parts[1]);
  pkgver = parse_pkgver(parts[2]);
  osver = parse_osver(parts[3]);
  time = parse_time(parts[4]);
  sha = parse_sha(parts[5]);
  runid = parse_runid(parts[6]);

  if (os && pkg && pkgver && osver && time && sha && runid) {
    return {"os": os, "osver": osver,
            "pkg": pkg, "pkgver": pkgver,
            "time": time, "sha": sha, "runid": runid}
  }

  return null;
}

/****************************************************************
 * Artifact properties
 ****************************************************************/

function parse_artifact(artifact) {
  artifact["parsed-name"] = parse_name(artifact["name"])
  return artifact;
}

function artifact_os(artifact) {
  return artifact["parsed-name"]["os"];
}

function artifact_osver(artifact) {
  return artifact["parsed-name"]["osver"];
}

function artifact_pkg(artifact) {
  return artifact["parsed-name"]["pkg"];
}

function artifact_pkgver(artifact) {
  return artifact["parsed-name"]["pkgver"];
}

function artifact_time(artifact) {
  return artifact["parsed-name"]["time"];
}

function artifact_sha(artifact) {
  return artifact["parsed-name"]["sha"];
}

function artifact_runid(artifact) {
  return artifact["parsed-name"]["runid"];
}

function artifact_url(artifact) {
  return artifact["url"];
}

function artifact_size(artifact) {
  return artifact["size_in_bytes"];
}

/****************************************************************
 * Artifact comparison
 ****************************************************************/

function os_compare(os1, os2) {
  if (os1 < os2) { return -1; }
  if (os1 > os2) { return 1; }
  return 0;
}

function osver_compare(osver1, osver2) {
  if (osver1 < osver2) { return -1; }
  if (osver1 > osver2) { return 1; }
  return 0;
}

function pkg_compare(pkg1, pkg2) {
  if (pkg1 < pkg2) { return -1; }
  if (pkg1 > pkg2) { return 1; }
  return 0;
}

function pkgver_compare(pkgver1, pkgver2) {
  function toNumbers(pkgver) {
    function toInt(str) { return parseInt(str); }

    parts = pkgver.split("-").concat(["0","0"]).slice(0,2)
    versions = parts[0].split(".").map(toInt).concat([0,0,0,0,0]).slice(0,5)
    revision = parts[1].split(".").map(toInt).concat([0,0,0,0,0]).slice(0,1)

    return versions.concat(revision)
  }

  function numbers_compare(nums1, nums2) {
    if (nums1.length == 0 && nums2.length == 0) {
      return 0;
    }
    if (nums1[0] < nums2[0]) { return -1; }
    if (nums1[0] > nums2[0]) { return 1; }
    return numbers_compare(nums1.slice(1), nums2.slice(1));
  }

  return numbers_compare(toNumbers(pkgver1), toNumbers(pkgver2));
}

function time_compare(time1, time2) {
  if (time1 < time2) { return -1; }
  if (time1 > time2) { return 1; }
  return 0;
}

function artifact_pkgver_compare(artifact1, artifact2) {
  return pkgver_compare(artifact_pkgver(artifact1),
                        artifact_pkgver(artifact2));
}

/****************************************************************
 * Artifact filters
 ****************************************************************/

function artifacts_filter_by_os(artifacts, os) {
  return artifacts.filter(
    function(artifact) { return artifact_os(artifact) == os; }
  )
}

function artifacts_filter_by_pkg(artifacts, pkg) {
  return artifacts.filter(
    function(artifact) { return artifact_pkg(artifact) == pkg; }
  )
}

/****************************************************************
 * Stable and latest artifacts
 ****************************************************************/

function artifacts_stable_and_latest(artifacts, os, pkg) {
  // TODO: handle indexing into zero-length lists
  os_artifacts = artifacts_filter_by_os(artifacts, os);

  stable_artifacts = artifacts_filter_by_pkg(os_artifacts, "cbmc").sort(artifact_pkgver_compare)
  latest_artifacts = artifacts_filter_by_pkg(os_artifacts, "cbmc-latest").sort(artifact_pkgver_compare)

  stable = stable_artifacts[stable_artifacts.length - 1];
  latest = latest_artifacts[latest_artifacts.length - 1];
  return [stable, latest];
}

function update_links(artifacts) {

  function valid_artifact(artifact) {
    return artifact["parsed-name"] != null;
  }
  artifacts = artifacts.filter(valid_artifact);
  console.log(artifacts);

  function update_link(id, artifact) {
    if (artifact == null || artifact_runid(artifact) == null) {
      $(id).removeAttr("href");
      $(id).text("not available");
      return;
    }
    MB = Math.ceil( parseInt(artifact_size(artifact)) / (1024 * 2024) );

    $(id).attr("href", run_url(artifact_runid(artifact)));
    $(id).text(`version ${artifact_pkgver(artifact)}`);
    $(id+"-text").text(`, size ${MB}Mb, commit ${artifact_sha(artifact)}`);
  }

  ubuntu16 = artifacts_stable_and_latest(artifacts, "Ubuntu16");
  update_link("#ubuntu16-stable", ubuntu16[0]);
  update_link("#ubuntu16-latest", ubuntu16[1]);

  ubuntu18 = artifacts_stable_and_latest(artifacts, "Ubuntu18");
  update_link("#ubuntu18-stable", ubuntu18[0]);
  update_link("#ubuntu18-latest", ubuntu18[1]);

  windows = artifacts_stable_and_latest(artifacts, "Windows");
  update_link("#windows-stable", windows[0]);
  update_link("#windows-latest", windows[1]);

  macos = artifacts_stable_and_latest(artifacts, "MacOS");
  update_link("#macos-stable", macos[0]);
  update_link("#macos-latest", macos[1]);
}

/****************************************************************/

$(document).ready(
  function() {
    $.getJSON(
      artifacts_url(),
      function(data){ update_links(data["artifacts"].map(parse_artifact)); }
    )
  }
);

/****************************************************************/
