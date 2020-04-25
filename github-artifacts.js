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
  if (lc == "vs2019") { return "VS2019"; }

  return null;
}

function parse_version(str) {
  if (str == null) { return false; }
  if (str.match(/^\d+(.\d+)*$/g) != null) {
    return str
  }
  return null;;
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

// Initial artifacts were inconsistently named.
function patch_name(name){
  name = name.replace("Ubuntu 16", "Ubuntu16");
  name = name.replace("Ubuntu 18", "Ubuntu18");
  name = name.replace("Windows VS2019", "VS2019");
  return name;
}

function parse_name(name){
  if (name == null) {
    return {"os": null, "version": null, "time": null, "sha": null};
  }

  name = patch_name(name);

  parts = name.split(/\s+/);
  os = parse_os(parts[0]);
  version = parse_version(parts[1]);
  time = parse_time(parts[2]);
  sha = parse_sha(parts[3]);
  runid = parse_runid(parts[4]);

  if (os && version && time && sha) {
    return {"os": os, "version": version, "time": time, "sha": sha,
            "runid": runid};
  }

  return {"os": null, "version": null, "time": null, "sha": null,
          "runid": null};
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

function artifact_version(artifact) {
  return artifact["parsed-name"]["version"];
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

function version_compare(version1, version2) {
  function toNumbers(version) {
    function toInt(str) { return parseInt(str); }
    return version.split(".").map(toInt).concat([0,0,0,0,0]).slice(0,5)
  }

  function numbers_compare(nums1, nums2) {
    if (nums1.length == 0 && nums2.length == 0) {
      return 0;
    }
    if (nums1[0] < nums2[0]) { return -1; }
    if (nums1[0] > nums2[0]) { return 1; }
    return numbers_compare(nums1.slice(1), nums2.slice(1));
  }

  return numbers_compare(toNumbers(version1), toNumbers(version2));
}

function time_compare(time1, time2) {
  if (time1 < time2) { return -1; }
  if (time1 > time2) { return 1; }
  return 0;
}

function os_compare(os1, os2) {
  if (os1 < os2) { return -1; }
  if (os1 > os2) { return 1; }
  return 0;
}

function runid_compare(id1, id2) {
  if (id1 && !id2) { return -1; }
  if (!id1 && !id2) { return 0; }
  if (!id1 && id2) { return 1; }

  int1 = parseInt(id1);
  int2 = parseInt(id2);
  if (int1 < int2) { return -1; }
  if (int1 > int2) { return 11; }
  return 0;
}

function artifact_compare(artifact1, artifact2) {
  if (!artifact1 || !artifact2) { return null; }

  return
    os_compare(artifact_os(artifact1), artifact_os(artifact2)) ||
    version_compare(artifact_version(artifact1), artifact_version(artifact2)) ||
    time_compare(artifact_time(artifact1), artifact_time(artifact2)) ||
    runid_compare(artifact_runid(artifact1),artifact_runid(artifact2));
}

/****************************************************************
 * Artifact filters
 ****************************************************************/

function artifacts_filter_by_os(artifacts, os) {
  return artifacts.filter(
    function(artifact) { return artifact_os(artifact) == os; }
  )
}

function artifacts_filter_by_version(artifacts, version) {
  return artifacts.filter(
    function(artifact) { return artifact_version(artifact) == version; }
  )
}

/****************************************************************
 * Stable and latest artifacts
 ****************************************************************/

function artifacts_stable_and_latest(artifacts, os) {
  sorted_artifacts = artifacts.sort(artifact_compare);
  os_artifacts = artifacts_filter_by_os(sorted_artifacts, os);
  versions = os_artifacts.map(artifact_version);
  version = versions.sort(version_compare)[versions.length - 1];
  version_artifacts = artifacts_filter_by_version(os_artifacts, version);
  stable = version_artifacts[0];
  latest = version_artifacts[version_artifacts.length - 1];

  return [stable, latest];
}

function runids_stable_and_latest(artifacts, os) {
  return artifacts_stable_and_latest(artifacts, os).map(artifact_runid);
}

function update_links(artifacts) {

  function valid_artifact(artifact) {
    return (artifact_os(artifact) != null &&
            artifact_version(artifact) != null &&
            artifact_time(artifact) != null &&
            artifact_runid(artifact) != null);
  }
  artifacts = artifacts.filter(valid_artifact);

  function update_link(id, artifact) {
    console.log(artifact);
    if (artifact == null || artifact_runid(artifact) == null) {
      $(id).removeAttr("href");
      $(id).text("not available");
      return;
    }
    console.log(artifact)
    MB = Math.ceil( parseInt(artifact_size(artifact)) / (1024 * 2024) );

    $(id).attr("href", run_url(artifact_runid(artifact)));
    $(id).text(`CBMC ${artifact_version(artifact)}`);
    $(id+"-text").text(`, size ${MB}Mb, commit ${artifact_sha(artifact)}`);
  }

  ubuntu16 = artifacts_stable_and_latest(artifacts, "Ubuntu16");
  console.log(ubuntu16);
  update_link("#ubuntu16-stable", ubuntu16[0]);
  update_link("#ubuntu16-latest", ubuntu16[1]);

  ubuntu18 = artifacts_stable_and_latest(artifacts, "Ubuntu18");
  update_link("#ubuntu18-stable", ubuntu18[0]);
  update_link("#ubuntu18-latest", ubuntu18[1]);

  windows = artifacts_stable_and_latest(artifacts, "VS2019");
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
